import re
from app.ir.models import WorkflowGraph, NodeType


class TemporalPyCompiler:
    def __init__(self):
        pass

    def compile(self, graph: WorkflowGraph) -> str:
        activities = []
        for node in graph.nodes:
            if node.type in [NodeType.TASK, NodeType.EXTERNAL_CALL]:
                clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', node.label.lower()).strip('_')
                activities.append(f"{clean_name}_activity")
        activities = sorted(list(set(activities)))

        lines = [
            '"""',
            f'Compiled Temporal Python Workflow: {graph.name}',
            f'Generated from verified policy: "{graph.policy_text}"',
            '"""',
            'from datetime import timedelta',
            'from temporalio import workflow',
            'from dataclasses import dataclass',
            'from typing import Optional, List, Dict, Any',
            '',
            'with workflow.unsafe.imports_passed_through():',
        ]
        for act in activities:
            lines.append(f'    from activities import {act}')
        lines.extend([
            '',
            '@dataclass',
            'class WorkflowInput:',
            '    purchase_amount: float = 0.0',
            '    requester_id: str = ""',
            '    vendor_id: Optional[str] = None',
            '    metadata: Optional[Dict[str, Any]] = None',
            '',
            '@dataclass',
            'class WorkflowResult:',
            '    status: str',
            '    history: List[str]',
            '',
            '@workflow.defn',
            f'class {re.sub(r"[^a-zA-Z0-9]", "", graph.name)}Workflow:',
            '    def __init__(self) -> None:',
            '        self._is_approved: Optional[bool] = None',
            '        self._approver: str = ""',
            '        self._status: str = "INITIALIZED"',
            '        self._history: List[str] = []',
            '',
            '    @workflow.signal',
            '    def approve(self, role: str) -> None:',
            '        self._is_approved = True',
            '        self._approver = role',
            '        self._history.append(f"Approved by {role}")',
            '',
            '    @workflow.signal',
            '    def reject(self, role: str) -> None:',
            '        self._is_approved = False',
            '        self._approver = role',
            '        self._history.append(f"Rejected by {role}")',
            '',
            '    @workflow.query',
            '    def get_status(self) -> str:',
            '        return self._status',
            '',
            '    @workflow.run',
            '    async def run(self, input_data: WorkflowInput) -> WorkflowResult:',
            '        self._status = "RUNNING"',
            '        self._history.append("Workflow started")',
            '',
        ])

        for node in graph.nodes:
            if node.type in [NodeType.START, NodeType.END]:
                continue
            elif node.type == NodeType.DECISION:
                lines.extend([
                    f'        # Decision: {node.label}',
                    f'        self._history.append("Evaluating: {node.label}")',
                    '',
                ])
            elif node.type == NodeType.APPROVAL:
                role = node.actor.role if node.actor else "Approver"
                lines.extend([
                    f'        # Human Approval: {node.label}',
                    f'        self._status = "WAITING_FOR_{role.upper().replace(" ", "_")}"',
                    f'        self._history.append("Waiting for approval from: {role}")',
                    '        await workflow.wait_condition(',
                    '            lambda: self._is_approved is not None,',
                    '            timeout=timedelta(days=7)',
                    '        )',
                    '        if not self._is_approved:',
                    '            self._status = "REJECTED"',
                    '            return WorkflowResult(status=self._status, history=self._history)',
                    '',
                ])
            elif node.type in [NodeType.TASK, NodeType.EXTERNAL_CALL]:
                clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', node.label.lower()).strip('_')
                act_func = f"{clean_name}_activity"
                lines.extend([
                    f'        # Activity: {node.label}',
                    f'        res_{clean_name} = await workflow.execute_activity(',
                    f'            {act_func},',
                    '            input_data,',
                    '            start_to_close_timeout=timedelta(minutes=5),',
                    '        )',
                    f'        self._history.append("{node.label} finished")',
                    '',
                ])

        lines.extend([
            '        self._status = "COMPLETED"',
            '        self._history.append("Workflow finished successfully")',
            '        return WorkflowResult(status=self._status, history=self._history)',
        ])

        return "\n".join(lines)
