import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from app.ir.models import (
    WorkflowGraph, WorkflowNode, WorkflowEdge, NodeType,
    SimulationResult, SimulationStep
)


def evaluate_guard_against_payload(guard_expr: str, payload: Dict[str, Any]) -> Tuple[bool, str]:
    if not guard_expr or not guard_expr.strip():
        return True, "No guard condition (unconditional)"
        
    expr = guard_expr.strip()
    
    # Check NOT wrapper
    not_match = re.match(r'^NOT\s*\((.+)\)$', expr, re.IGNORECASE)
    if not_match:
        inner_res, inner_msg = evaluate_guard_against_payload(not_match.group(1), payload)
        return (not inner_res), f"NOT ({inner_msg})"

    # Match binary comparison: <var> <op> <val>
    comp_pattern = re.compile(
        r'([a-zA-Z0-9_\.]+)\s*(<=|>=|==|!=|<|>|=)\s*([a-zA-Z0-9_\.\-]+)',
        re.IGNORECASE
    )
    match = comp_pattern.match(expr)
    if not match:
        # Check direct boolean lookup
        val = payload.get(expr)
        if val is not None:
            return bool(val), f"{expr} is {val}"
        return True, f"Defaulted {expr} to true"
        
    var_name, op, right_str = match.group(1).strip(), match.group(2).strip(), match.group(3).strip()
    
    actual_val = payload.get(var_name)
    if actual_val is None:
        # Fallback to key without prefix
        short_key = var_name.split('.')[-1]
        actual_val = payload.get(short_key)
        
    if actual_val is None:
        return False, f"Variable '{var_name}' missing from payload context."
        
    try:
        actual_num = float(actual_val)
        target_num = float(right_str)
        
        if op in [">", "gt"]:
            res = actual_num > target_num
        elif op in ["<", "lt"]:
            res = actual_num < target_num
        elif op in [">=", "gte"]:
            res = actual_num >= target_num
        elif op in ["<=", "lte"]:
            res = actual_num <= target_num
        elif op in ["==", "="]:
            res = actual_num == target_num
        elif op in ["!=", "<>"]:
            res = actual_num != target_num
        else:
            res = False
            
        return res, f"{var_name} ({actual_num}) {op} {target_num} -> {res}"
    except ValueError:
        # String or boolean comparison
        target_clean = right_str.strip('"\'').lower()
        actual_clean = str(actual_val).strip('"\'').lower()
        if op in ["==", "="]:
            res = actual_clean == target_clean
        elif op == "!=":
            res = actual_clean != target_clean
        else:
            res = False
        return res, f"{var_name} ('{actual_val}') {op} '{right_str}' -> {res}"


Tuple_Eval = tuple[bool, str]


class WorkflowSimulator:
    def __init__(self):
        pass

    def run_simulation(
        self,
        graph: WorkflowGraph,
        initial_payload: Dict[str, Any],
        max_steps: int = 40,
        auto_approve: bool = True
    ) -> SimulationResult:
        trace: List[SimulationStep] = []
        variables = dict(initial_payload)
        
        start_nodes = [n for n in graph.nodes if n.type == NodeType.START]
        if not start_nodes:
            return SimulationResult(
                success=False,
                status="error_no_start",
                message="Workflow has no START node.",
                trace=[],
                final_variables=variables
            )
            
        curr_node_id = start_nodes[0].id
        step_count = 0
        
        while step_count < max_steps:
            step_count += 1
            curr_node = graph.get_node(curr_node_id)
            if not curr_node:
                return SimulationResult(
                    success=False,
                    status="error_invalid_node",
                    message=f"Simulation reached non-existent node '{curr_node_id}'.",
                    trace=trace,
                    final_variables=variables
                )
                
            # Log current step
            step_action = f"Executing {curr_node.type.value.upper()}: {curr_node.label}"
            actor_name = curr_node.actor.role if curr_node.actor else None
            
            # Check terminal END node
            if curr_node.type == NodeType.END:
                trace.append(SimulationStep(
                    step_number=step_count,
                    current_node_id=curr_node.id,
                    node_label=curr_node.label,
                    node_type=curr_node.type,
                    actor=actor_name,
                    action_taken="Workflow execution completed successfully at END node.",
                    evaluated_guards=[],
                    variable_state=dict(variables),
                    timestamp=datetime.utcnow().isoformat()
                ))
                return SimulationResult(
                    success=True,
                    status="completed",
                    final_node_id=curr_node.id,
                    trace=trace,
                    final_variables=variables,
                    message="Workflow execution completed successfully."
                )

            # Check Approval node behavior
            if curr_node.type == NodeType.APPROVAL and not auto_approve:
                trace.append(SimulationStep(
                    step_number=step_count,
                    current_node_id=curr_node.id,
                    node_label=curr_node.label,
                    node_type=curr_node.type,
                    actor=actor_name,
                    action_taken=f"Paused: Waiting for human sign-off from {actor_name or 'Approver'}",
                    evaluated_guards=[],
                    variable_state=dict(variables),
                    timestamp=datetime.utcnow().isoformat()
                ))
                return SimulationResult(
                    success=True,
                    status="blocked_waiting_approval",
                    final_node_id=curr_node.id,
                    trace=trace,
                    final_variables=variables,
                    message=f"Execution suspended awaiting sign-off from {actor_name or 'Authorized Approver'}."
                )

            # Find next outgoing edge
            out_edges = graph.get_outgoing_edges(curr_node.id)
            if not out_edges:
                trace.append(SimulationStep(
                    step_number=step_count,
                    current_node_id=curr_node.id,
                    node_label=curr_node.label,
                    node_type=curr_node.type,
                    actor=actor_name,
                    action_taken="Deadlock: Node has no outgoing transitions.",
                    evaluated_guards=[],
                    variable_state=dict(variables),
                    timestamp=datetime.utcnow().isoformat()
                ))
                return SimulationResult(
                    success=False,
                    status="error_deadlock",
                    final_node_id=curr_node.id,
                    trace=trace,
                    final_variables=variables,
                    message=f"Deadlock at '{curr_node.label}' (no outgoing edges)."
                )

            # Evaluate outgoing guards
            chosen_edge: Optional[WorkflowEdge] = None
            eval_logs = []
            
            for edge in out_edges:
                if edge.guard and edge.guard.expression:
                    passed, log_msg = evaluate_guard_against_payload(edge.guard.expression, variables)
                    eval_logs.append({"guard": edge.guard.expression, "passed": passed, "details": log_msg})
                    if passed and not chosen_edge:
                        chosen_edge = edge
                else:
                    eval_logs.append({"guard": "None", "passed": True, "details": "Unconditional transition"})
                    if not chosen_edge:
                        chosen_edge = edge

            if not chosen_edge:
                # No edge matched guards
                trace.append(SimulationStep(
                    step_number=step_count,
                    current_node_id=curr_node.id,
                    node_label=curr_node.label,
                    node_type=curr_node.type,
                    actor=actor_name,
                    action_taken="No outgoing guard conditions matched current payload context.",
                    evaluated_guards=eval_logs,
                    variable_state=dict(variables),
                    timestamp=datetime.utcnow().isoformat()
                ))
                return SimulationResult(
                    success=False,
                    status="error_unhandled_guard",
                    final_node_id=curr_node.id,
                    trace=trace,
                    final_variables=variables,
                    message="All decision guards evaluated to false for the input payload."
                )

            trace.append(SimulationStep(
                step_number=step_count,
                current_node_id=curr_node.id,
                node_label=curr_node.label,
                node_type=curr_node.type,
                actor=actor_name,
                action_taken=step_action,
                evaluated_guards=eval_logs,
                variable_state=dict(variables),
                traversed_edge_id=chosen_edge.id,
                timestamp=datetime.utcnow().isoformat()
            ))

            curr_node_id = chosen_edge.target

        return SimulationResult(
            success=False,
            status="error_max_steps_exceeded",
            final_node_id=curr_node_id,
            trace=trace,
            final_variables=variables,
            message="Simulation exceeded maximum step limit (possible cycle)."
        )
