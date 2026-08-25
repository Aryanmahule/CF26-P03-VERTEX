import uuid
import re
from typing import List, Dict, Any, Optional
from app.ir.models import (
    WorkflowGraph, WorkflowNode, WorkflowEdge, NodeType, Actor,
    AmbiguityFinding, AmbiguityOption, FindingCategory, Severity
)
from app.org.org_model import OrgChart


class AmbiguityDetector:
    def __init__(self, org_chart: OrgChart):
        self.org_chart = org_chart

    def detect_ambiguities(self, graph: WorkflowGraph) -> List[AmbiguityFinding]:
        findings: List[AmbiguityFinding] = []
        
        # 1. Check for Missing Actors on TASK and APPROVAL nodes
        for node in graph.nodes:
            if node.type in [NodeType.TASK, NodeType.APPROVAL]:
                if not node.actor or not node.actor.role:
                    # Provide options based on task context
                    options = []
                    label_lower = node.label.lower()
                    
                    if "vendor" in label_lower:
                        options = [
                            AmbiguityOption(
                                id="opt_procurement",
                                label="Assign to Procurement Officer",
                                description="Procurement team verifies vendor compliance and contracts.",
                                action_type="set_actor",
                                payload={"node_id": node.id, "role": "Procurement Officer", "entity_id": "procurement_officer"}
                            ),
                            AmbiguityOption(
                                id="opt_compliance",
                                label="Assign to Compliance Officer",
                                description="Compliance team conducts KYC/AML verification.",
                                action_type="set_actor",
                                payload={"node_id": node.id, "role": "Compliance Officer", "entity_id": "compliance_officer"}
                            ),
                            AmbiguityOption(
                                id="opt_team_lead",
                                label="Assign to Team Lead",
                                description="Operations supervisor performs vendor verification.",
                                action_type="set_actor",
                                payload={"node_id": node.id, "role": "Team Lead", "entity_id": "team_lead"}
                            )
                        ]
                    elif "budget" in label_lower or "finance" in label_lower:
                        options = [
                            AmbiguityOption(
                                id="opt_finance_mgr",
                                label="Assign to Finance Manager",
                                description="Finance Manager (approval limit $50,000)",
                                action_type="set_actor",
                                payload={"node_id": node.id, "role": "Finance Manager", "entity_id": "finance_manager"}
                            ),
                            AmbiguityOption(
                                id="opt_dept_mgr",
                                label="Assign to Department Manager",
                                description="Department Manager (approval limit $15,000)",
                                action_type="set_actor",
                                payload={"node_id": node.id, "role": "Department Manager", "entity_id": "dept_manager"}
                            )
                        ]
                    else:
                        options = [
                            AmbiguityOption(
                                id="opt_dept_mgr",
                                label="Assign to Department Manager",
                                description="Department Manager signs off on operational steps.",
                                action_type="set_actor",
                                payload={"node_id": node.id, "role": "Department Manager", "entity_id": "dept_manager"}
                            ),
                            AmbiguityOption(
                                id="opt_team_lead",
                                label="Assign to Team Lead",
                                description="Team Lead performs initial review.",
                                action_type="set_actor",
                                payload={"node_id": node.id, "role": "Team Lead", "entity_id": "team_lead"}
                            ),
                            AmbiguityOption(
                                id="opt_employee",
                                label="Assign to Requester/Employee",
                                description="Self-service action performed by the requester.",
                                action_type="set_actor",
                                payload={"node_id": node.id, "role": "Employee", "entity_id": "employee"}
                            )
                        ]
                        
                    findings.append(AmbiguityFinding(
                        id=f"amb_missing_actor_{node.id}",
                        category=FindingCategory.MISSING_ACTOR,
                        severity=Severity.WARNING,
                        node_id=node.id,
                        source_span=node.source_span,
                        source_text=node.source_text or node.label,
                        title=f"Missing Actor on '{node.label}'",
                        description=f"Action '{node.label}' does not specify which role or department is responsible for execution.",
                        suggestion="Assign a specific authorized role from the organization model.",
                        candidate_options=options
                    ))

        # 2. Check for Polysemic or Generic Roles (e.g. "Finance", "Manager")
        for node in graph.nodes:
            if node.actor and node.actor.role:
                role_str = node.actor.role.strip()
                candidates = self.org_chart.get_candidate_roles(role_str)
                if len(candidates) > 1 and not node.actor.resolved_entity_id:
                    options = [
                        AmbiguityOption(
                            id=f"opt_role_{c.id}",
                            label=f"Clarify as {c.name}",
                            description=f"Department: {c.department} (Limit: ${c.approval_limit:,.0f}" if c.approval_limit else f"Department: {c.department}",
                            action_type="set_actor",
                            payload={"node_id": node.id, "role": c.name, "entity_id": c.id}
                        )
                        for c in candidates
                    ]
                    findings.append(AmbiguityFinding(
                        id=f"amb_polysemy_{node.id}",
                        category=FindingCategory.POLYSEMY,
                        severity=Severity.WARNING,
                        node_id=node.id,
                        source_span=node.source_span,
                        source_text=node.source_text or node.actor.role,
                        title=f"Ambiguous Role '{role_str}'",
                        description=f"The term '{role_str}' maps to multiple distinct org-chart roles ({', '.join(c.name for c in candidates)}).",
                        suggestion="Specify whether this requires a Manager, Director, or VP level sign-off.",
                        candidate_options=options
                    ))

        # 3. Check for Sequential vs Parallel Order Ambiguity (Elliptical Conjunctions)
        # Check if policy has comma-separated list of tasks without explicit "then"/"after"
        if "then" not in graph.policy_text.lower() and "after" not in graph.policy_text.lower():
            action_nodes = [n for n in graph.nodes if n.type in [NodeType.TASK, NodeType.APPROVAL, NodeType.EXTERNAL_CALL]]
            # If there are 3+ action nodes and no parallel splits currently in graph
            has_split = any(n.type == NodeType.PARALLEL_SPLIT for n in graph.nodes)
            if len(action_nodes) >= 3 and not has_split:
                options = [
                    AmbiguityOption(
                        id="opt_keep_sequential",
                        label="Confirm Sequential Order",
                        description="Execute steps one after another in order of appearance.",
                        action_type="confirm_order",
                        payload={"mode": "sequential"}
                    ),
                    AmbiguityOption(
                        id="opt_make_parallel",
                        label="Convert to Parallel Execution",
                        description="Execute independent steps concurrently using a Parallel Gateway.",
                        action_type="make_parallel",
                        payload={"mode": "parallel", "node_ids": [n.id for n in action_nodes]}
                    )
                ]
                findings.append(AmbiguityFinding(
                    id="amb_order_conjunction",
                    category=FindingCategory.ORDER_AMBIGUITY,
                    severity=Severity.INFO,
                    source_span=(0, min(len(graph.policy_text), 80)),
                    source_text=graph.policy_text[:80] + ("..." if len(graph.policy_text) > 80 else ""),
                    title="Sequential vs Parallel Execution Ambiguity",
                    description=f"Task order across {len(action_nodes)} actions was inferred from comma list punctuation without explicit temporal connectives ('then', 'after').",
                    suggestion="Confirm whether verification and check tasks can run concurrently in parallel.",
                    candidate_options=options
                ))

        # 4. Check for Underspecified Guards (vague terms)
        vague_terms = ["large", "small", "urgent", "soon", "reasonable", "high", "normal"]
        for edge in graph.edges:
            if edge.guard and edge.guard.expression:
                for term in vague_terms:
                    if term in edge.guard.expression.lower() or term in edge.guard.source_text.lower():
                        findings.append(AmbiguityFinding(
                            id=f"amb_vague_guard_{edge.id}",
                            category=FindingCategory.UNDERSPECIFIED_GUARD,
                            severity=Severity.WARNING,
                            edge_id=edge.id,
                            source_span=edge.source_span,
                            source_text=edge.guard.source_text,
                            title=f"Underspecified Guard Condition ('{term}')",
                            description=f"The condition uses subjective term '{term}' without a concrete numeric threshold or glossary definition.",
                            suggestion="Replace qualitative predicate with quantitative threshold (e.g., '> $10,000').",
                            candidate_options=[
                                AmbiguityOption(
                                    id="opt_guard_10k",
                                    label="Set threshold > $10,000",
                                    description="Standard threshold for high-value purchases",
                                    action_type="set_guard",
                                    payload={"edge_id": edge.id, "expression": "purchase.amount > 10000"}
                                ),
                                AmbiguityOption(
                                    id="opt_guard_50k",
                                    label="Set threshold > $50,000",
                                    description="Executive threshold requiring Director approval",
                                    action_type="set_guard",
                                    payload={"edge_id": edge.id, "expression": "purchase.amount > 50000"}
                                )
                            ]
                        ))

        return findings


def apply_ambiguity_resolution(graph: WorkflowGraph, finding_id: str, chosen_option_id: str, org_chart: OrgChart) -> WorkflowGraph:
    """
    Applies the chosen resolution option directly to the WorkflowGraph IR.
    """
    # Clone graph
    new_graph = graph.model_copy(deep=True)
    
    # 1. Detect ambiguities to find the matching option
    detector = AmbiguityDetector(org_chart)
    findings = detector.detect_ambiguities(new_graph)
    
    target_finding = next((f for f in findings if f.id == finding_id), None)
    if not target_finding:
        return new_graph
        
    target_option = next((o for o in target_finding.candidate_options if o.id == chosen_option_id), None)
    if not target_option:
        return new_graph
        
    action_type = target_option.action_type
    payload = target_option.payload
    
    if action_type == "set_actor":
        node_id = payload.get("node_id")
        role_name = payload.get("role")
        entity_id = payload.get("entity_id")
        for node in new_graph.nodes:
            if node.id == node_id:
                role_def = org_chart.roles.get(entity_id) if entity_id else org_chart.find_role(role_name)
                dept = role_def.department if role_def else "General"
                node.actor = Actor(
                    role=role_name,
                    resolved_entity_id=entity_id,
                    department=dept,
                    confidence=1.0
                )
                if not node.required_authorization and role_def and role_def.permissions:
                    node.required_authorization = role_def.permissions[0]
                    
    elif action_type == "set_guard":
        edge_id = payload.get("edge_id")
        expr = payload.get("expression")
        for edge in new_graph.edges:
            if edge.id == edge_id and edge.guard:
                edge.guard.expression = expr
                
    elif action_type == "make_parallel":
        # Convert action nodes to parallel split/join
        node_ids = payload.get("node_ids", [])
        if len(node_ids) >= 2:
            target_nodes = [n for n in new_graph.nodes if n.id in node_ids]
            
            # Find incoming edge to first target node and outgoing edge from last
            first_id = node_ids[0]
            last_id = node_ids[-1]
            
            incoming_to_first = [e for e in new_graph.edges if e.target == first_id]
            outgoing_from_last = [e for e in new_graph.edges if e.source == last_id]
            
            # Create Split and Join
            split_id = f"node_split_{uuid.uuid4().hex[:4]}"
            join_id = f"node_join_{uuid.uuid4().hex[:4]}"
            
            split_node = WorkflowNode(
                id=split_id,
                type=NodeType.PARALLEL_SPLIT,
                label="Parallel Split",
                source_span=(0, 0),
                source_text="Parallel execution",
                confidence=1.0
            )
            join_node = WorkflowNode(
                id=join_id,
                type=NodeType.PARALLEL_JOIN,
                label="Parallel Join",
                source_span=(0, 0),
                source_text="Join branches",
                confidence=1.0
            )
            
            new_graph.nodes.extend([split_node, join_node])
            
            # Remove internal sequential edges between target nodes
            new_edges = []
            for e in new_graph.edges:
                if e.source in node_ids and e.target in node_ids:
                    continue
                if e in incoming_to_first:
                    # Redirect source -> split_node
                    e.target = split_id
                    new_edges.append(e)
                elif e in outgoing_from_last:
                    # Redirect join_node -> target
                    e.source = join_id
                    new_edges.append(e)
                else:
                    new_edges.append(e)
                    
            # Add split -> node and node -> join edges
            for n in target_nodes:
                new_edges.append(WorkflowEdge(
                    id=f"edge_{split_id}_{n.id}",
                    source=split_id,
                    target=n.id,
                    source_text="Parallel branch",
                    confidence=1.0
                ))
                new_edges.append(WorkflowEdge(
                    id=f"edge_{n.id}_{join_id}",
                    source=n.id,
                    target=join_id,
                    source_text="Join branch",
                    confidence=1.0
                ))
                
            new_graph.edges = new_edges

    return new_graph
