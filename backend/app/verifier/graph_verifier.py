import networkx as nx
from typing import List, Dict, Any, Set, Optional
from app.ir.models import (
    WorkflowGraph, WorkflowNode, WorkflowEdge, NodeType,
    VerificationCheckResult, FindingCategory, Severity
)
from app.rules.rules_manager import get_rules_manager, RulesConfig


class GraphSoundnessVerifier:
    def __init__(self, rules: Optional[RulesConfig] = None):
        self.rules = rules or get_rules_manager().get_rules()

    def verify(self, graph: WorkflowGraph) -> List[VerificationCheckResult]:
        results: List[VerificationCheckResult] = []
        
        # Build NetworkX DiGraph
        G = nx.DiGraph()
        node_map = {n.id: n for n in graph.nodes}
        
        for node in graph.nodes:
            G.add_node(node.id, type=node.type, label=node.label)
            
        for edge in graph.edges:
            G.add_edge(edge.source, edge.target, id=edge.id, guard=edge.guard)

        # 1. Check for START and END nodes
        start_nodes = [n for n in graph.nodes if n.type == NodeType.START]
        end_nodes = [n for n in graph.nodes if n.type == NodeType.END]
        
        if not start_nodes:
            results.append(VerificationCheckResult(
                passed=False,
                checker_name="Graph Soundness",
                title="Missing START Node",
                details="Workflow graph does not have any entry point (START node).",
                category=FindingCategory.GRAPH_SOUNDNESS,
                severity=Severity.CRITICAL,
                suggestion="Add a designated START node to anchor execution."
            ))
            return results

        if self.rules.graph_validity.require_single_start and len(start_nodes) > 1:
            results.append(VerificationCheckResult(
                passed=False,
                checker_name="Graph Soundness",
                title=f"Multiple START Nodes ({len(start_nodes)})",
                details="Workflow rules require exactly one designated START node.",
                category=FindingCategory.GRAPH_SOUNDNESS,
                severity=Severity.ERROR,
                suggestion="Merge initial entry points into a single START node."
            ))

        if not end_nodes:
            results.append(VerificationCheckResult(
                passed=False,
                checker_name="Graph Soundness",
                title="Missing END Node",
                details="Workflow graph does not have any terminal completion point (END node).",
                category=FindingCategory.GRAPH_SOUNDNESS,
                severity=Severity.CRITICAL,
                suggestion="Add an explicit END node for terminal paths."
            ))
            return results

        start_id = start_nodes[0].id
        
        # 2. Reachability from START (Dead Code Detection)
        reachable = set(nx.descendants(G, start_id)) | {start_id}
        unreachable = set(node_map.keys()) - reachable
        
        if unreachable:
            for un_id in unreachable:
                n = node_map.get(un_id)
                results.append(VerificationCheckResult(
                    passed=False,
                    checker_name="Graph Soundness",
                    title=f"Unreachable Node: '{n.label if n else un_id}'",
                    details=f"Node '{un_id}' cannot be reached by any path from START.",
                    category=FindingCategory.GRAPH_SOUNDNESS,
                    severity=Severity.ERROR,
                    node_id=un_id,
                    source_span=n.source_span if n else (0, 0),
                    source_text=n.source_text if n else "",
                    suggestion="Add an incoming edge from predecessor or remove unreachable node."
                ))
        else:
            results.append(VerificationCheckResult(
                passed=True,
                checker_name="Graph Soundness",
                title="Reachability Check Passed",
                details="All nodes in the workflow are reachable from START.",
                category=FindingCategory.GRAPH_SOUNDNESS,
                severity=Severity.INFO
            ))

        # 3. Termination Check (Every reachable node must have a path to an END node)
        end_ids = set(e.id for e in end_nodes)
        sink_nodes = []
        for n_id in reachable:
            n = node_map[n_id]
            if n.type == NodeType.END:
                continue
            # Check if any path exists from n_id to any end node
            has_path_to_end = False
            for e_id in end_ids:
                if nx.has_path(G, n_id, e_id):
                    has_path_to_end = True
                    break
            if not has_path_to_end:
                sink_nodes.append(n)

        if sink_nodes:
            for s in sink_nodes:
                results.append(VerificationCheckResult(
                    passed=False,
                    checker_name="Graph Soundness",
                    title=f"Sink Trap / Dead-End: '{s.label}'",
                    details=f"Node '{s.label}' has no path to an END node, creating an unhandled deadlock.",
                    category=FindingCategory.GRAPH_SOUNDNESS,
                    severity=Severity.ERROR,
                    node_id=s.id,
                    source_span=s.source_span,
                    source_text=s.source_text,
                    suggestion="Connect an outgoing transition from this node towards an END node."
                ))
        else:
            results.append(VerificationCheckResult(
                passed=True,
                checker_name="Graph Soundness",
                title="Termination Soundness Verified",
                details="Every valid execution path successfully terminates at an END node.",
                category=FindingCategory.GRAPH_SOUNDNESS,
                severity=Severity.INFO
            ))

        # 4. Decision Gate Branch Completeness
        if self.rules.branch_completeness.require_dual_branch_on_decision:
            for node in graph.nodes:
                if node.type == NodeType.DECISION:
                    outgoing = graph.get_outgoing_edges(node.id)
                    if len(outgoing) < 2:
                        results.append(VerificationCheckResult(
                            passed=False,
                            checker_name="Branch Completeness",
                            title=f"Incomplete Decision Gate: '{node.label}'",
                            details=f"Decision gate has only {len(outgoing)} branch(es). Rules require at least 2 branches (condition + complementary / else path).",
                            category=FindingCategory.GRAPH_SOUNDNESS,
                            severity=Severity.ERROR,
                            node_id=node.id,
                            source_span=node.source_span,
                            source_text=node.source_text,
                            suggestion="Add a complementary branch (e.g. 'amount <= threshold' or default bypass path)."
                        ))

        # 5. Cycle Detection & Soundness
        cycles = list(nx.simple_cycles(G))
        if cycles:
            for cyc in cycles:
                cyc_nodes = [node_map[nid].label for nid in cyc if nid in node_map]
                # Check if intentional retry loop
                is_retry_loop = any(
                    "retry" in node_map[nid].label.lower() or 
                    "retry" in str(node_map[nid].metadata).lower()
                    for nid in cyc if nid in node_map
                )
                severity = Severity.WARNING if is_retry_loop else Severity.ERROR
                results.append(VerificationCheckResult(
                    passed=False,
                    checker_name="Graph Soundness",
                    title="Infinite Loop / Unbounded Cycle Detected" if not is_retry_loop else "Bounded Retry Loop Detected",
                    details=f"Cycle: {' -> '.join(cyc_nodes)}. Ensure loop variables are decremented/bounded.",
                    category=FindingCategory.GRAPH_SOUNDNESS,
                    severity=severity,
                    suggestion="Ensure an explicit max-retry count or exit guard exists."
                ))
        else:
            results.append(VerificationCheckResult(
                passed=True,
                checker_name="Graph Soundness",
                title="Acyclic Soundness Verified",
                details="No unconstrained cycles or infinite recursion loops detected.",
                category=FindingCategory.GRAPH_SOUNDNESS,
                severity=Severity.INFO
            ))

        # 6. Parallel Split/Join Balance (Workflow-Net Soundness)
        splits = [n for n in graph.nodes if n.type == NodeType.PARALLEL_SPLIT]
        joins = [n for n in graph.nodes if n.type == NodeType.PARALLEL_JOIN]
        
        if len(splits) != len(joins):
            results.append(VerificationCheckResult(
                passed=False,
                checker_name="Graph Soundness",
                title="Unbalanced Parallel Gateways",
                details=f"Found {len(splits)} Parallel Split(s) but {len(joins)} Parallel Join(s). Workflow nets require matching split/join pairs.",
                category=FindingCategory.GRAPH_SOUNDNESS,
                severity=Severity.ERROR,
                suggestion="Ensure each parallel fork converges at a corresponding parallel join."
            ))
        else:
            for s, j in zip(splits, joins):
                s_out = len(graph.get_outgoing_edges(s.id))
                j_in = len(graph.get_incoming_edges(j.id))
                if s_out != j_in:
                    results.append(VerificationCheckResult(
                        passed=False,
                        checker_name="Graph Soundness",
                        title="Mismatched Parallel Branch Count",
                        details=f"Parallel Split '{s.id}' forks into {s_out} branches, but Join '{j.id}' only receives {j_in} branches. This causes token leak or deadlock.",
                        category=FindingCategory.GRAPH_SOUNDNESS,
                        severity=Severity.ERROR,
                        node_id=s.id,
                        suggestion=f"Align parallel join incoming edges with all {s_out} split branches."
                    ))

        return results
