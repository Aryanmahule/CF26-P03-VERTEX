import re
import uuid
from typing import List, Tuple, Dict, Any, Optional
from app.ir.models import (
    WorkflowNode, WorkflowEdge, NodeType, Actor, Guard, WorkflowGraph
)
from app.org.org_model import OrgChart
from app.parser.preprocessor import PreprocessedPolicy, extract_quantities_and_amounts, TextSpan


def classify_node_type(clause_text: str) -> NodeType:
    text_lower = clause_text.lower().strip()
    
    # Approvals
    if any(k in text_lower for k in [
        "approval", "approve", "sign-off", "signoff", "sign off", 
        "authorized by", "authorization from", "obtain approval", "require approval"
    ]):
        return NodeType.APPROVAL
        
    # External Calls (integrations, tickets, notifications, payments)
    if any(k in text_lower for k in [
        "create the", "create a", "issue", "generate ticket", "send notification", 
        "send email", "notify", "call api", "post to", "procurement ticket", 
        "charge card", "provision", "deploy", "store in database", "trigger webhook"
    ]):
        return NodeType.EXTERNAL_CALL
        
    # Parallel splits/joins
    if any(k in text_lower for k in ["in parallel", "simultaneously", "concurrently", "at the same time"]):
        return NodeType.PARALLEL_SPLIT
        
    # Condition/Decision indicators inside clause
    if any(k in text_lower for k in ["decide", "evaluate whether", "branch", "check if"]):
        return NodeType.DECISION
        
    # Default is a standard task
    return NodeType.TASK


def extract_actor_from_clause(clause_text: str, org_chart: OrgChart) -> Optional[Actor]:
    text_lower = clause_text.lower()
    
    # Check org chart roles directly
    for r_id, role in org_chart.roles.items():
        if role.name.lower() in text_lower:
            return Actor(
                role=role.name,
                resolved_entity_id=role.id,
                department=role.department,
                confidence=0.95
            )
        for alias in role.aliases:
            # Word boundary search
            if re.search(r'\b' + re.escape(alias.lower()) + r'\b', text_lower):
                # If alias is ambiguous like "Finance" (could be Finance Manager or Finance Director)
                candidates = org_chart.get_candidate_roles(alias)
                conf = 0.6 if len(candidates) > 1 else 0.9
                return Actor(
                    role=role.name,
                    resolved_entity_id=role.id if len(candidates) == 1 else None,
                    department=role.department,
                    confidence=conf
                )
                
    # Check general role patterns like "by <Role>", "from <Role>", "<Role> performs"
    role_pattern = re.compile(r'(?:by|from|obtain)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:approval|signoff|team|verification)|\b|,|\.)')
    match = role_pattern.search(clause_text)
    if match:
        extracted = match.group(1).strip()
        matched_role = org_chart.find_role(extracted)
        if matched_role:
            return Actor(
                role=matched_role.name,
                resolved_entity_id=matched_role.id,
                department=matched_role.department,
                confidence=0.85
            )
        return Actor(role=extracted, confidence=0.5)
        
    return None


def extract_guard_condition(text: str, raw_text: str) -> Optional[Tuple[Guard, Tuple[int, int]]]:
    """Detects if a sentence or clause sets up a decision guard condition."""
    # Pattern e.g. "For any purchase over $10,000", "If budget.amount > 5000", "When loan amount exceeds 50000"
    cond_pattern = re.compile(
        r'\b(for any|for every|if|when|where|unless|in case of|provided that)\s+(.+?)(?:,\s*(?=[a-zA-Z])|;|\.|$)',
        re.IGNORECASE
    )
    match = cond_pattern.search(text)
    if not match:
        return None
        
    cond_body = match.group(2).strip()
    span_start = raw_text.find(match.group(0).rstrip(' ,;.'))
    span_end = span_start + len(match.group(0).rstrip(' ,;.')) if span_start != -1 else (0, len(text))
    
    quantities = extract_quantities_and_amounts(cond_body)
    
    # Infer variable name
    var_name = "purchase.amount"
    if "budget" in cond_body.lower():
        var_name = "budget.amount"
    elif "travel" in cond_body.lower() or "flight" in cond_body.lower():
        var_name = "travel.cost"
    elif "loan" in cond_body.lower() or "credit" in cond_body.lower():
        var_name = "loan.amount"
    elif "risk" in cond_body.lower():
        var_name = "vendor.risk_score"
    elif "incident" in cond_body.lower():
        var_name = "incident.severity"
    elif "score" in cond_body.lower():
        var_name = "loan.credit_score"
        
    if quantities:
        q = quantities[0]
        expr = f"{var_name} {q['operator']} {q['value']}"
        return Guard(
            expression=expr,
            source_text=match.group(0),
            variables=[var_name],
            operator=q['operator'],
            left_operand=var_name,
            right_operand=q['value']
        ), (span_start, span_end)
    else:
        # Boolean or textual condition
        expr = f"{var_name} == True"
        return Guard(
            expression=expr,
            source_text=match.group(0),
            variables=[var_name],
            operator="==",
            left_operand=var_name,
            right_operand=True
        ), (span_start, span_end)


def parse_policy_to_draft_graph(preprocessed: PreprocessedPolicy, org_chart: OrgChart) -> WorkflowGraph:
    raw_text = preprocessed.raw_text
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []
    provenance: Dict[str, str] = {}
    
    # 1. Create START node
    start_node = WorkflowNode(
        id="node_start",
        type=NodeType.START,
        label="Start Workflow",
        source_span=(0, 0),
        source_text="Workflow Initiation",
        confidence=1.0
    )
    nodes.append(start_node)
    
    # 2. Check for root guard / decision
    guard_res = extract_guard_condition(raw_text, raw_text)
    decision_node = None
    if guard_res:
        root_guard, g_span = guard_res
        decision_node = WorkflowNode(
            id=f"node_dec_{uuid.uuid4().hex[:6]}",
            type=NodeType.DECISION,
            label=f"Evaluate ({root_guard.expression})",
            source_span=g_span,
            source_text=root_guard.source_text,
            confidence=0.9,
            preconditions=[]
        )
        nodes.append(decision_node)
        
        # Start -> Decision
        edges.append(WorkflowEdge(
            id=f"edge_start_{decision_node.id}",
            source=start_node.id,
            target=decision_node.id,
            source_text="Initiate evaluation",
            confidence=1.0
        ))
        
    last_node_id = decision_node.id if decision_node else start_node.id
    
    # 3. Extract action clauses
    action_nodes: List[WorkflowNode] = []
    pending_guard: Optional[Guard] = None
    
    for idx, clause in enumerate(preprocessed.clauses):
        clause_text = clause.text.strip()
        # If clause is purely a conditional guard (e.g. "For any purchase over $10,000", "where purchase amount is under $10,000")
        if re.match(r'^(?:for any|for every|if|when|where|unless|in case of|provided that)\b', clause_text, re.IGNORECASE):
            if not any(v in clause_text.lower() for v in ["verify", "check", "obtain", "create", "issue", "send", "approve", "notify", "perform"]):
                # Extract intermediate clause guard
                clause_guard_res = extract_guard_condition(clause_text, raw_text)
                if clause_guard_res and clause_guard_res[0].expression != (guard_res[0].expression if guard_res else None):
                    pending_guard = clause_guard_res[0]
                continue

        # Clean leading connectives
        cleaned_text = re.sub(r'^(?:for any[^,]+,|if[^,]+,|when[^,]+,|and then|then|and)\s*', '', clause_text, flags=re.IGNORECASE).strip()
        if not cleaned_text or len(cleaned_text) < 4:
            continue
            
        n_type = classify_node_type(cleaned_text)
        actor = extract_actor_from_clause(cleaned_text, org_chart)
        
        # Check required authorization if approval or task
        req_auth = None
        if n_type == NodeType.APPROVAL:
            req_auth = "approve_procurement" if "procurement" in raw_text.lower() or "purchase" in raw_text.lower() else "approve_general"
        elif "ticket" in cleaned_text.lower():
            req_auth = "create_procurement_ticket"
        elif "vendor" in cleaned_text.lower():
            req_auth = "verify_vendor"
            
        span = (clause.start, clause.end)
        node_id = f"node_act_{idx+1}_{uuid.uuid4().hex[:4]}"
        
        # Format clean label
        label = cleaned_text[0].upper() + cleaned_text[1:]
        
        node_preconditions = [pending_guard] if pending_guard else []
        node = WorkflowNode(
            id=node_id,
            type=n_type,
            label=label,
            actor=actor,
            required_authorization=req_auth,
            preconditions=node_preconditions,
            source_span=span,
            source_text=clause_text,
            confidence=actor.confidence if actor else 0.75
        )
        nodes.append(node)
        action_nodes.append((node, pending_guard))
        pending_guard = None
        provenance[node_id] = clause_text

    # Check if policy indicates parallel execution
    is_parallel = any(
        conn['word'] in ['in parallel', 'simultaneously', 'concurrently'] 
        for conn in preprocessed.detected_connectives
    )
    
    if is_parallel and len(action_nodes) > 1:
        # Create Parallel Split and Join
        split_node = WorkflowNode(
            id=f"node_split_{uuid.uuid4().hex[:4]}",
            type=NodeType.PARALLEL_SPLIT,
            label="Parallel Split",
            source_span=(0, 0),
            source_text="In parallel",
            confidence=0.9
        )
        join_node = WorkflowNode(
            id=f"node_join_{uuid.uuid4().hex[:4]}",
            type=NodeType.PARALLEL_JOIN,
            label="Parallel Join",
            source_span=(0, 0),
            source_text="Join parallel branches",
            confidence=0.9
        )
        nodes.extend([split_node, join_node])
        
        # Connect last node to split
        edges.append(WorkflowEdge(
            id=f"edge_{last_node_id}_{split_node.id}",
            source=last_node_id,
            target=split_node.id,
            guard=guard_res[0] if (last_node_id == (decision_node.id if decision_node else None)) else None,
            source_text=guard_res[0].source_text if (last_node_id == (decision_node.id if decision_node else None)) else "",
            confidence=1.0
        ))
        
        # Split -> each action -> Join
        for act, act_guard in action_nodes:
            edges.append(WorkflowEdge(
                id=f"edge_{split_node.id}_{act.id}",
                source=split_node.id,
                target=act.id,
                guard=act_guard,
                source_text="Parallel branch",
                confidence=0.9
            ))
            edges.append(WorkflowEdge(
                id=f"edge_{act.id}_{join_node.id}",
                source=act.id,
                target=join_node.id,
                source_text="Join branch",
                confidence=0.9
            ))
        last_node_id = join_node.id
    else:
        # Sequential linking
        for i, (act, act_guard) in enumerate(action_nodes):
            edge_guard = (guard_res[0] if (i == 0 and last_node_id == (decision_node.id if decision_node else None)) else act_guard)
            edge = WorkflowEdge(
                id=f"edge_{last_node_id}_{act.id}",
                source=last_node_id,
                target=act.id,
                guard=edge_guard,
                source_text=edge_guard.source_text if edge_guard else f"Sequence step {i+1}",
                confidence=0.8 if not is_parallel and len(action_nodes) > 1 else 1.0
            )
            edges.append(edge)
            last_node_id = act.id

    # 4. Create END node
    end_node = WorkflowNode(
        id="node_end",
        type=NodeType.END,
        label="End Workflow",
        source_span=(len(raw_text), len(raw_text)),
        source_text="Completion",
        confidence=1.0
    )
    nodes.append(end_node)
    
    # Connect last action to END
    edges.append(WorkflowEdge(
        id=f"edge_{last_node_id}_{end_node.id}",
        source=last_node_id,
        target=end_node.id,
        source_text="Final step to completion",
        confidence=1.0
    ))
    
    # If decision exists, create a default False/Alternate path to END
    if decision_node:
        # Check if alternate branch already exists
        first_action_id = action_nodes[0][0].id if action_nodes else end_node.id
        has_alt = any(e.source == decision_node.id and e.target != first_action_id for e in edges)
        if not has_alt and len(action_nodes) > 0 and guard_res:
            root_guard = guard_res[0]
            # Construct standard / fast-track alternate task node
            alt_task_node = WorkflowNode(
                id=f"node_alt_fasttrack_{uuid.uuid4().hex[:4]}",
                type=NodeType.TASK,
                label="Standard Fast-Track Processing",
                actor=Actor(role="Employee", department="General", confidence=0.9),
                required_authorization=None,
                source_span=(0, 0),
                source_text="Default path when threshold is not exceeded",
                confidence=0.9,
                metadata={"postconditions": ["fast_track_executed"]}
            )
            nodes.append(alt_task_node)
            
            # Format clean complementary expression
            if root_guard.operator == ">":
                opp_expr = f"{root_guard.left_operand} <= {root_guard.right_operand}"
                opp_op = "<="
            elif root_guard.operator == ">=":
                opp_expr = f"{root_guard.left_operand} < {root_guard.right_operand}"
                opp_op = "<"
            elif root_guard.operator == "<":
                opp_expr = f"{root_guard.left_operand} >= {root_guard.right_operand}"
                opp_op = ">="
            elif root_guard.operator == "<=":
                opp_expr = f"{root_guard.left_operand} > {root_guard.right_operand}"
                opp_op = ">"
            else:
                opp_expr = f"NOT ({root_guard.expression})"
                opp_op = "!="

            alt_guard = Guard(
                expression=opp_expr,
                source_text=f"Otherwise ({opp_expr})",
                variables=root_guard.variables,
                operator=opp_op,
                left_operand=root_guard.left_operand,
                right_operand=root_guard.right_operand
            )

            # Edge 1: Decision -> Fast-Track Task
            edges.append(WorkflowEdge(
                id=f"edge_{decision_node.id}_{alt_task_node.id}",
                source=decision_node.id,
                target=alt_task_node.id,
                guard=alt_guard,
                label=opp_expr,
                source_text=f"Condition false: {opp_expr}",
                confidence=0.9
            ))
            # Edge 2: Fast-Track Task -> End
            edges.append(WorkflowEdge(
                id=f"edge_{alt_task_node.id}_{end_node.id}",
                source=alt_task_node.id,
                target=end_node.id,
                source_text="Fast-track completion",
                confidence=0.95
            ))

    roles_list = []
    for n in nodes:
        if n.actor and n.actor not in roles_list:
            roles_list.append(n.actor)

    return WorkflowGraph(
        id=f"wf_{uuid.uuid4().hex[:8]}",
        name="Parsed Policy Workflow",
        version="1.0.0",
        policy_text=raw_text,
        nodes=nodes,
        edges=edges,
        roles=roles_list,
        provenance=provenance
    )
