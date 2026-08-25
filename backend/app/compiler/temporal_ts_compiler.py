import re
from app.ir.models import WorkflowGraph, NodeType


class TemporalTSCompiler:
    def __init__(self):
        pass

    def compile(self, graph: WorkflowGraph) -> str:
        # Generate activity names
        activities = []
        for node in graph.nodes:
            if node.type in [NodeType.TASK, NodeType.EXTERNAL_CALL]:
                clean_name = re.sub(r'[^a-zA-Z0-9]', '', node.label.title())
                activities.append(f"{clean_name[:1].lower() + clean_name[1:]}Activity")
        activities = sorted(list(set(activities)))

        lines = [
            "/**",
            f" * Compiled Temporal.io TypeScript Workflow: {graph.name}",
            f" * Generated from verified policy: \"{graph.policy_text}\"",
            " */",
            "import { proxyActivities, defineSignal, defineQuery, setHandler, condition } from '@temporalio/workflow';",
            "",
            "// Activity Interface Definition",
            "export interface WorkflowActivities {",
        ]
        for act in activities:
            lines.append(f"  {act}(payload: any): Promise<{{ success: boolean; data?: any }}>;")
        lines.append("}")
        lines.append("")
        lines.append("const {")
        for act in activities:
            lines.append(f"  {act},")
        lines.append("} = proxyActivities<WorkflowActivities>({")
        lines.append("  startToCloseTimeout: '10 minutes',")
        lines.append("  retry: { initialInterval: '1s', maximumAttempts: 3 },")
        lines.append("});")
        lines.append("")
        lines.append("// Signals & Queries for Human Approvals")
        lines.append("export const approveSignal = defineSignal<[string]>('approve');")
        lines.append("export const rejectSignal = defineSignal<[string]>('reject');")
        lines.append("export const getStatusQuery = defineQuery<string>('getStatus');")
        lines.append("")
        lines.append("export interface WorkflowInput {")
        lines.append("  purchaseAmount?: number;")
        lines.append("  requesterId: string;")
        lines.append("  vendorId?: string;")
        lines.append("  metadata?: Record<string, any>;")
        lines.append("}")
        lines.append("")
        lines.append(f"export async function {graph.id.replace('-', '_')}(input: WorkflowInput): Promise<{{ status: string; history: string[] }}> {{")
        lines.append("  let status = 'RUNNING';")
        lines.append("  const history: string[] = [];")
        lines.append("  let isApproved: boolean | null = null;")
        lines.append("  let approverRole: string = '';")
        lines.append("")
        lines.append("  // Signal Handlers")
        lines.append("  setHandler(approveSignal, (role: string) => {")
        lines.append("    isApproved = true;")
        lines.append("    approverRole = role;")
        lines.append("    history.push(`Approved by ${role}`);")
        lines.append("  });")
        lines.append("  setHandler(rejectSignal, (role: string) => {")
        lines.append("    isApproved = false;")
        lines.append("    approverRole = role;")
        lines.append("    history.push(`Rejected by ${role}`);")
        lines.append("  });")
        lines.append("  setHandler(getStatusQuery, () => status);")
        lines.append("")
        lines.append("  history.push('Workflow started');")
        lines.append("")

        # Step through nodes
        for node in graph.nodes:
            if node.type == NodeType.START:
                continue
            elif node.type == NodeType.END:
                continue
            elif node.type == NodeType.DECISION:
                lines.append(f"  // Decision Gateway: {node.label}")
                lines.append(f"  history.push('Evaluating condition: {node.label}');")
                lines.append("")
            elif node.type == NodeType.APPROVAL:
                actor_role = node.actor.role if node.actor else "Authorized Approver"
                lines.append(f"  // Human-in-the-loop Approval: {node.label}")
                lines.append(f"  status = 'WAITING_FOR_APPROVAL_{actor_role.upper().replace(' ', '_')}';")
                lines.append(f"  history.push('Awaiting signoff from: {actor_role}');")
                lines.append("  // Wait up to 7 days for approval signal")
                lines.append("  const approved = await condition(() => isApproved !== null, '7 days');")
                lines.append("  if (!approved || isApproved === false) {")
                lines.append("    status = 'REJECTED';")
                lines.append("    return { status, history };")
                lines.append("  }")
                lines.append("")
            elif node.type in [NodeType.TASK, NodeType.EXTERNAL_CALL]:
                clean_name = re.sub(r'[^a-zA-Z0-9]', '', node.label.title())
                act_func = f"{clean_name[:1].lower() + clean_name[1:]}Activity"
                lines.append(f"  // Activity: {node.label}")
                lines.append(f"  const res_{clean_name} = await {act_func}(input);")
                lines.append(f"  history.push('{node.label} completed');")
                lines.append("")

        lines.append("  status = 'COMPLETED';")
        lines.append("  history.push('Workflow successfully completed');")
        lines.append("  return { status, history };")
        lines.append("}")
        return "\n".join(lines)
