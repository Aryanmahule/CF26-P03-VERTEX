import xml.etree.ElementTree as ET
from xml.dom import minidom
from typing import Dict, Tuple
from app.ir.models import WorkflowGraph, NodeType, WorkflowNode, WorkflowEdge


class BPMNCompiler:
    def __init__(self):
        pass

    def compile(self, graph: WorkflowGraph) -> str:
        # Define Namespaces
        bpmn_ns = "http://www.omg.org/spec/BPMN/20100524/MODEL"
        bpmndi_ns = "http://www.omg.org/spec/BPMN/20100524/DI"
        dc_ns = "http://www.omg.org/spec/DD/20100524/DC"
        di_ns = "http://www.omg.org/spec/DD/20100524/DI"
        xsi_ns = "http://www.w3.org/2001/XMLSchema-instance"

        ET.register_namespace("bpmn", bpmn_ns)
        ET.register_namespace("bpmndi", bpmndi_ns)
        ET.register_namespace("dc", dc_ns)
        ET.register_namespace("di", di_ns)
        ET.register_namespace("xsi", xsi_ns)

        definitions = ET.Element(f"{{{bpmn_ns}}}definitions", {
            "id": f"Definitions_{graph.id}",
            "targetNamespace": "http://bpmn.io/schema/bpmn",
            "exporter": "NL-Verified-Workflow-Compiler",
            "exporterVersion": "1.0.0"
        })

        process = ET.SubElement(definitions, f"{{{bpmn_ns}}}process", {
            "id": f"Process_{graph.id}",
            "name": graph.name,
            "isExecutable": "true"
        })

        # Calculate simple grid coordinates for DI layout
        node_positions: Dict[str, Tuple[int, int, int, int]] = {}  # id -> (x, y, width, height)
        curr_x = 160
        curr_y = 120
        spacing_x = 180

        # Create BPMN Elements
        for idx, node in enumerate(graph.nodes):
            elem_tag = "task"
            w, h = 120, 80

            if node.type == NodeType.START:
                elem_tag = "startEvent"
                w, h = 36, 36
            elif node.type == NodeType.END:
                elem_tag = "endEvent"
                w, h = 36, 36
            elif node.type == NodeType.DECISION:
                elem_tag = "exclusiveGateway"
                w, h = 50, 50
            elif node.type in [NodeType.PARALLEL_SPLIT, NodeType.PARALLEL_JOIN]:
                elem_tag = "parallelGateway"
                w, h = 50, 50
            elif node.type == NodeType.APPROVAL:
                elem_tag = "userTask"
                w, h = 130, 80
            elif node.type == NodeType.EXTERNAL_CALL:
                elem_tag = "serviceTask"
                w, h = 130, 80
            else:
                elem_tag = "task"
                w, h = 120, 80

            node_elem = ET.SubElement(process, f"{{{bpmn_ns}}}{elem_tag}", {
                "id": node.id,
                "name": node.label
            })

            # Documentation with actor & audit info
            if node.actor or node.required_authorization or node.source_text:
                doc = ET.SubElement(node_elem, f"{{{bpmn_ns}}}documentation")
                doc_lines = []
                if node.actor:
                    doc_lines.append(f"Actor: {node.actor.role} ({node.actor.department or 'General'})")
                if node.required_authorization:
                    doc_lines.append(f"Required Auth: {node.required_authorization}")
                if node.source_text:
                    doc_lines.append(f"Source Text: \"{node.source_text}\"")
                doc.text = "\n".join(doc_lines)

            # Assign coordinates
            node_positions[node.id] = (curr_x, curr_y, w, h)
            curr_x += spacing_x

        # Create Sequence Flows
        for edge in graph.edges:
            flow_elem = ET.SubElement(process, f"{{{bpmn_ns}}}sequenceFlow", {
                "id": edge.id,
                "sourceRef": edge.source,
                "targetRef": edge.target,
                "name": edge.label or (edge.guard.expression if edge.guard else "")
            })

            if edge.guard and edge.guard.expression:
                cond = ET.SubElement(flow_elem, f"{{{bpmn_ns}}}conditionExpression", {
                    f"{{{xsi_ns}}}type": "bpmn:tFormalExpression"
                })
                cond.text = edge.guard.expression

        # Create BPMNDiagram & BPMNPlane
        diagram = ET.SubElement(definitions, f"{{{bpmndi_ns}}}BPMNDiagram", {"id": f"BPMNDiagram_{graph.id}"})
        plane = ET.SubElement(diagram, f"{{{bpmndi_ns}}}BPMNPlane", {
            "id": f"BPMNPlane_{graph.id}",
            "bpmnElement": f"Process_{graph.id}"
        })

        # Add Shapes
        for node in graph.nodes:
            x, y, w, h = node_positions[node.id]
            shape = ET.SubElement(plane, f"{{{bpmndi_ns}}}BPMNShape", {
                "id": f"BPMNShape_{node.id}",
                "bpmnElement": node.id
            })
            bounds = ET.SubElement(shape, f"{{{dc_ns}}}Bounds", {
                "x": str(x),
                "y": str(y),
                "width": str(w),
                "height": str(h)
            })

        # Add Edges
        for edge in graph.edges:
            edge_shape = ET.SubElement(plane, f"{{{bpmndi_ns}}}BPMNEdge", {
                "id": f"BPMNEdge_{edge.id}",
                "bpmnElement": edge.id
            })
            src_x, src_y, src_w, src_h = node_positions.get(edge.source, (0, 0, 0, 0))
            tgt_x, tgt_y, tgt_w, tgt_h = node_positions.get(edge.target, (0, 0, 0, 0))
            
            # Waypoints
            ET.SubElement(edge_shape, f"{{{di_ns}}}waypoint", {
                "x": str(src_x + src_w),
                "y": str(src_y + src_h // 2)
            })
            ET.SubElement(edge_shape, f"{{{di_ns}}}waypoint", {
                "x": str(tgt_x),
                "y": str(tgt_y + tgt_h // 2)
            })

        # Pretty-print XML
        raw_xml = ET.tostring(definitions, encoding="utf-8")
        parsed = minidom.parseString(raw_xml)
        return parsed.toprettyxml(indent="  ")
