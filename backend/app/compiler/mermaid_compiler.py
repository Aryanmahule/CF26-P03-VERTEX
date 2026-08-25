import re
from app.ir.models import WorkflowGraph, NodeType


class MermaidCompiler:
    def __init__(self):
        pass

    def compile(self, graph: WorkflowGraph) -> str:
        lines = ["flowchart TD"]

        # Shape definitions
        for node in graph.nodes:
            clean_label = node.label.replace('"', "'")
            actor_str = f"\\n[{node.actor.role}]" if node.actor else ""
            
            if node.type == NodeType.START:
                lines.append(f'    {node.id}(["{clean_label}"])')
            elif node.type == NodeType.END:
                lines.append(f'    {node.id}(["{clean_label}"])')
            elif node.type == NodeType.DECISION:
                lines.append(f'    {node.id}{{"{clean_label}"}}')
            elif node.type in [NodeType.PARALLEL_SPLIT, NodeType.PARALLEL_JOIN]:
                lines.append(f'    {node.id}[["{clean_label}"]]')
            elif node.type == NodeType.APPROVAL:
                lines.append(f'    {node.id}[/"{clean_label}{actor_str}"/]')
            elif node.type == NodeType.EXTERNAL_CALL:
                lines.append(f'    {node.id}[\\"{clean_label}{actor_str}\\"/]')
            else:
                lines.append(f'    {node.id}["{clean_label}{actor_str}"]')

        # Edges
        for edge in graph.edges:
            label_text = edge.label or ""
            if edge.guard and edge.guard.expression:
                label_text = edge.guard.expression
                
            clean_edge_label = label_text.replace('"', "'").strip()
            if clean_edge_label:
                lines.append(f'    {edge.source} -->|"{clean_edge_label}"| {edge.target}')
            else:
                lines.append(f'    {edge.source} --> {edge.target}')

        return "\n".join(lines)
