from typing import Dict
from app.ir.models import WorkflowGraph, TargetFormat, CompiledArtifact
from app.compiler.bpmn_compiler import BPMNCompiler
from app.compiler.temporal_ts_compiler import TemporalTSCompiler
from app.compiler.temporal_py_compiler import TemporalPyCompiler
from app.compiler.xstate_compiler import XStateCompiler
from app.compiler.mermaid_compiler import MermaidCompiler


class CompilerService:
    def __init__(self):
        self.bpmn_compiler = BPMNCompiler()
        self.temporal_ts_compiler = TemporalTSCompiler()
        self.temporal_py_compiler = TemporalPyCompiler()
        self.xstate_compiler = XStateCompiler()
        self.mermaid_compiler = MermaidCompiler()

    def compile_all(self, graph: WorkflowGraph) -> Dict[TargetFormat, CompiledArtifact]:
        return {
            TargetFormat.BPMN: self.compile(graph, TargetFormat.BPMN),
            TargetFormat.TEMPORAL_TS: self.compile(graph, TargetFormat.TEMPORAL_TS),
            TargetFormat.TEMPORAL_PY: self.compile(graph, TargetFormat.TEMPORAL_PY),
            TargetFormat.XSTATE: self.compile(graph, TargetFormat.XSTATE),
            TargetFormat.MERMAID: self.compile(graph, TargetFormat.MERMAID)
        }

    def compile(self, graph: WorkflowGraph, target_format: TargetFormat) -> CompiledArtifact:
        if target_format == TargetFormat.BPMN:
            content = self.bpmn_compiler.compile(graph)
            return CompiledArtifact(
                format=TargetFormat.BPMN,
                filename=f"{graph.id}.bpmn",
                content=content,
                language="xml",
                description="BPMN 2.0 XML with semantic activity nodes, gateways, and layout coordinates."
            )
        elif target_format == TargetFormat.TEMPORAL_TS:
            content = self.temporal_ts_compiler.compile(graph)
            return CompiledArtifact(
                format=TargetFormat.TEMPORAL_TS,
                filename=f"{graph.id}.workflow.ts",
                content=content,
                language="typescript",
                description="Temporal.io TypeScript workflow with activities, signals, and approval condition loops."
            )
        elif target_format == TargetFormat.TEMPORAL_PY:
            content = self.temporal_py_compiler.compile(graph)
            return CompiledArtifact(
                format=TargetFormat.TEMPORAL_PY,
                filename=f"{graph.id}_workflow.py",
                content=content,
                language="python",
                description="Temporal.io Python SDK workflow with dataclasses, signals, and activities."
            )
        elif target_format == TargetFormat.XSTATE:
            content = self.xstate_compiler.compile(graph)
            return CompiledArtifact(
                format=TargetFormat.XSTATE,
                filename=f"{graph.id}.machine.json",
                content=content,
                language="json",
                description="XState v5 JSON state machine definition with states, transitions, and context."
            )
        elif target_format == TargetFormat.MERMAID:
            content = self.mermaid_compiler.compile(graph)
            return CompiledArtifact(
                format=TargetFormat.MERMAID,
                filename=f"{graph.id}.mmd",
                content=content,
                language="mermaid",
                description="Mermaid flowchart graph syntax for visual markdown embedding."
            )
        else:
            raise ValueError(f"Unsupported target format: {target_format}")
