import json
from app.ir.models import WorkflowGraph, NodeType


class XStateCompiler:
    def __init__(self):
        pass

    def compile(self, graph: WorkflowGraph) -> str:
        states = {}
        initial_state = "idle"
        
        start_nodes = [n for n in graph.nodes if n.type == NodeType.START]
        if start_nodes:
            # First state after start
            out_e = graph.get_outgoing_edges(start_nodes[0].id)
            if out_e:
                initial_state = out_e[0].target
            else:
                initial_state = start_nodes[0].id

        for node in graph.nodes:
            out_edges = graph.get_outgoing_edges(node.id)
            transitions = {}
            
            for idx, e in enumerate(out_edges):
                event_name = "NEXT" if len(out_edges) == 1 else (f"BRANCH_{idx+1}" if not e.label else e.label.upper().replace(' ', '_'))
                trans_obj = {"target": e.target}
                if e.guard and e.guard.expression:
                    trans_obj["guard"] = e.guard.expression
                transitions[event_name] = trans_obj
                
            node_state = {
                "id": node.id,
                "description": node.label,
                "meta": {
                    "type": node.type.value,
                    "actor": node.actor.role if node.actor else None,
                    "source_text": node.source_text
                }
            }
            
            if node.type == NodeType.END:
                node_state["type"] = "final"
            elif node.type == NodeType.APPROVAL:
                node_state["on"] = {
                    "APPROVE": {"target": out_edges[0].target if out_edges else "node_end"},
                    "REJECT": {"target": "node_end"}
                }
            elif transitions:
                node_state["on"] = transitions
                
            states[node.id] = node_state

        machine_def = {
            "id": graph.id,
            "initial": initial_state,
            "context": {
                "variables": {k: None for k in graph.glossary.keys()} if graph.glossary else {},
                "history": []
            },
            "states": states
        }

        return json.dumps(machine_def, indent=2)
