import re
from typing import List, Dict, Any, Optional
from app.ir.models import (
    WorkflowGraph, WorkflowNode, NodeType,
    VerificationCheckResult, FindingCategory, Severity
)
from app.org.org_model import OrgChart
from app.rules.rules_manager import get_rules_manager, RulesConfig


class PolicyAuthorizationVerifier:
    def __init__(self, org_chart: OrgChart, rules: Optional[RulesConfig] = None):
        self.org_chart = org_chart
        self.rules = rules or get_rules_manager().get_rules()

    def verify(self, graph: WorkflowGraph) -> List[VerificationCheckResult]:
        results: List[VerificationCheckResult] = []
        
        # 1. Extract numeric policy threshold if present in graph guards or preconditions
        max_policy_amount = 0.0
        for edge in graph.edges:
            if edge.guard and edge.guard.right_operand is not None:
                try:
                    val = float(edge.guard.right_operand)
                    if val > max_policy_amount:
                        max_policy_amount = val
                except (ValueError, TypeError):
                    pass

        for node in graph.nodes:
            for g in node.preconditions:
                if g.right_operand is not None:
                    try:
                        val = float(g.right_operand)
                        if val > max_policy_amount:
                            max_policy_amount = val
                    except (ValueError, TypeError):
                        pass

        # 2. Check Role Resolution and Permissions for every actor node
        assigned_roles_in_wf = []
        executed_permissions_by_role: Dict[str, List[str]] = {}
        
        for node in graph.nodes:
            # Check NLP Confidence Thresholds
            blocking_thresh = self.rules.ambiguity_and_confidence.blocking_confidence_threshold
            warn_thresh = self.rules.ambiguity_and_confidence.warning_confidence_threshold

            if node.confidence < blocking_thresh:
                results.append(VerificationCheckResult(
                    passed=False,
                    checker_name="Confidence Threshold",
                    title=f"Low Confidence Extraction (<{int(blocking_thresh*100)}%): '{node.label}'",
                    details=f"NLP extraction confidence is {int(node.confidence*100)}%, below mandatory {int(blocking_thresh*100)}% threshold. Deployment is blocked until reviewed.",
                    category=FindingCategory.UNDERSPECIFIED_GUARD,
                    severity=Severity.ERROR,
                    node_id=node.id,
                    source_span=node.source_span,
                    source_text=node.source_text,
                    suggestion="Manually confirm or edit the node properties in the side panel."
                ))
            elif node.confidence < warn_thresh:
                results.append(VerificationCheckResult(
                    passed=False,
                    checker_name="Confidence Threshold",
                    title=f"Moderate Confidence Flag ({int(node.confidence*100)}%): '{node.label}'",
                    details=f"Extraction confidence is {int(node.confidence*100)}%. Confirm details before final deployment.",
                    category=FindingCategory.UNDERSPECIFIED_GUARD,
                    severity=Severity.WARNING,
                    node_id=node.id,
                    source_span=node.source_span,
                    source_text=node.source_text,
                    suggestion="Review node configuration."
                ))

            # Check Vague Terms
            for vague_term in self.rules.ambiguity_and_confidence.vague_terms:
                check_text = f"{node.label} {node.source_text}".lower()
                if re.search(r'\b' + re.escape(vague_term) + r'\b', check_text):
                    results.append(VerificationCheckResult(
                        passed=False,
                        checker_name="Vague Term Detection",
                        title=f"Qualitative / Vague Term Detected: '{vague_term}'",
                        details=f"Step '{node.label}' uses underspecified language ('{vague_term}'). Business rules require concrete numerical thresholds or SLAs.",
                        category=FindingCategory.UNDERSPECIFIED_GUARD,
                        severity=Severity.WARNING,
                        node_id=node.id,
                        source_span=node.source_span,
                        source_text=node.source_text,
                        suggestion=f"Replace '{vague_term}' with an explicit SLA (e.g. 'within 2 hours') or defined threshold."
                    ))

            # Verify Actor Assignment & Resolution
            if node.type in [NodeType.TASK, NodeType.APPROVAL]:
                if not node.actor or not node.actor.role or node.actor.role.upper() == "UNRESOLVED":
                    results.append(VerificationCheckResult(
                        passed=False,
                        checker_name="Role Resolution",
                        title=f"Missing / Unresolved Actor: '{node.label}'",
                        details=f"Node '{node.label}' lacks an assigned actor or its role could not be resolved in the role dictionary.",
                        category=FindingCategory.MISSING_ACTOR,
                        severity=Severity.WARNING if node.type == NodeType.TASK else Severity.ERROR,
                        node_id=node.id,
                        source_span=node.source_span,
                        source_text=node.source_text,
                        suggestion="Assign a valid IAM role from the role dictionary in the detail drawer."
                    ))
                    continue

                role_name = node.actor.role
                # Check org chart / dictionary
                role_def = self.org_chart.find_role(role_name)
                canonical_id = self.rules.role_resolution.role_dictionary.get(role_name.strip().lower())
                if not role_def and canonical_id:
                    role_def = self.org_chart.roles.get(canonical_id)

                if not role_def:
                    results.append(VerificationCheckResult(
                        passed=False,
                        checker_name="Authorization & RBAC",
                        title=f"Unrecognized Role: '{role_name}'",
                        details=f"The role '{role_name}' assigned to '{node.label}' does not exist in the enterprise IAM dictionary.",
                        category=FindingCategory.AUTHORIZATION,
                        severity=Severity.ERROR,
                        node_id=node.id,
                        source_span=node.source_span,
                        source_text=node.source_text,
                        suggestion="Map this task to a valid organization role (e.g., Procurement Officer, Finance Manager)."
                    ))
                    continue

                assigned_roles_in_wf.append((node, role_def))
                
                # Track permissions
                action_perm = node.required_authorization or ("approve_procurement" if node.type == NodeType.APPROVAL else "verify_vendor")
                if role_def.id not in executed_permissions_by_role:
                    executed_permissions_by_role[role_def.id] = []
                executed_permissions_by_role[role_def.id].append(action_perm)

                # Check required permission
                if node.required_authorization and not self.org_chart.has_permission(role_def.id, node.required_authorization):
                    results.append(VerificationCheckResult(
                        passed=False,
                        checker_name="Authorization & RBAC",
                        title=f"Permission Deficit: '{role_def.name}'",
                        details=f"Role '{role_def.name}' lacks required permission '{node.required_authorization}' for '{node.label}'.",
                        category=FindingCategory.AUTHORIZATION,
                        severity=Severity.ERROR,
                        node_id=node.id,
                        source_span=node.source_span,
                        source_text=node.source_text,
                        suggestion=f"Assign '{node.required_authorization}' to '{role_def.name}' or reassign step."
                    ))

                # Check approval limit threshold against tier
                if max_policy_amount > 0 and node.type == NodeType.APPROVAL:
                    if role_def.approval_limit is not None and max_policy_amount > role_def.approval_limit:
                        results.append(VerificationCheckResult(
                            passed=False,
                            checker_name="Authorization & RBAC",
                            title=f"Approval Limit Exceeded: ${max_policy_amount:,.0f} > ${role_def.approval_limit:,.0f}",
                            details=f"Role '{role_def.name}' has approval ceiling of ${role_def.approval_limit:,.0f}, but workflow handles amounts up to ${max_policy_amount:,.0f}.",
                            category=FindingCategory.LIMIT_EXCEEDED,
                            severity=Severity.ERROR,
                            node_id=node.id,
                            source_span=node.source_span,
                            source_text=node.source_text,
                            suggestion="Escalate approval to Finance Director ($250k) or CFO ($1M)."
                        ))

        # 3. Segregation of Duties (SoD) Checks from rules_config.json
        for sod_rule in self.rules.authorization.segregation_of_duties:
            action_a = sod_rule.action_a
            action_b = sod_rule.action_b
            
            for role_id, perms in executed_permissions_by_role.items():
                has_a = action_a in perms or any(action_a in p for p in perms)
                has_b = action_b in perms or any(action_b in p for p in perms)
                if has_a and has_b:
                    role_obj = self.org_chart.roles.get(role_id)
                    role_title = role_obj.name if role_obj else role_id
                    results.append(VerificationCheckResult(
                        passed=False,
                        checker_name="Segregation of Duties (SoD)",
                        title=f"SoD Conflict: {sod_rule.name}",
                        details=f"Role '{role_title}' is assigned to both '{action_a}' and '{action_b}'. {sod_rule.description}",
                        category=FindingCategory.SEPARATION_OF_DUTY,
                        severity=Severity.ERROR,
                        suggestion=f"Split responsibilities: assign '{action_a}' and '{action_b}' to distinct organizational roles."
                    ))

        # If no authorization errors occurred, add success confirmation
        if not any(r.category in [FindingCategory.AUTHORIZATION, FindingCategory.LIMIT_EXCEEDED, FindingCategory.SEPARATION_OF_DUTY] and not r.passed for r in results):
            results.append(VerificationCheckResult(
                passed=True,
                checker_name="Authorization & RBAC",
                title="IAM Authorization & SoD Verified",
                details="All actor roles exist, permissions match required actions, spending limits are respected, and no SoD violations were found.",
                category=FindingCategory.AUTHORIZATION,
                severity=Severity.INFO
            ))

        return results
