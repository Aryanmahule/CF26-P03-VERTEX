from datetime import datetime
from typing import List, Optional
from app.ir.models import WorkflowGraph, VerificationReport, Severity
from app.org.org_model import OrgChart, get_default_org_chart
from app.verifier.graph_verifier import GraphSoundnessVerifier
from app.verifier.policy_verifier import PolicyAuthorizationVerifier
from app.verifier.smt_verifier import SMTConstraintVerifier
from app.ambiguity.detector import AmbiguityDetector
from app.rules.rules_manager import get_rules_manager, RulesConfig


class VerificationOrchestrator:
    def __init__(self, org_chart: Optional[OrgChart] = None, rules: Optional[RulesConfig] = None):
        self.org_chart = org_chart or get_default_org_chart()
        self.rules = rules or get_rules_manager().get_rules()
        self.graph_verifier = GraphSoundnessVerifier(self.rules)
        self.policy_verifier = PolicyAuthorizationVerifier(self.org_chart, self.rules)
        self.smt_verifier = SMTConstraintVerifier()
        self.ambiguity_detector = AmbiguityDetector(self.org_chart)

    def reload_rules(self, rules: Optional[RulesConfig] = None):
        self.rules = rules or get_rules_manager().get_rules()
        self.graph_verifier = GraphSoundnessVerifier(self.rules)
        self.policy_verifier = PolicyAuthorizationVerifier(self.org_chart, self.rules)

    def run_full_verification(self, graph: WorkflowGraph) -> VerificationReport:
        # Pull latest rules
        self.reload_rules()

        # 1. Run Ambiguity Detector
        ambiguities = self.ambiguity_detector.detect_ambiguities(graph)
        
        # 2. Run Static Verifiers
        soundness_results = self.graph_verifier.verify(graph)
        policy_results = self.policy_verifier.verify(graph)
        smt_results = self.smt_verifier.verify(graph)
        
        all_checks = soundness_results + policy_results + smt_results
        
        # Determine pass/fail booleans
        soundness_passed = not any(c.severity in [Severity.ERROR, Severity.CRITICAL] for c in soundness_results)
        policy_passed = not any(c.severity in [Severity.ERROR, Severity.CRITICAL] for c in policy_results)
        smt_passed = not any(c.severity in [Severity.ERROR, Severity.CRITICAL] for c in smt_results)
        
        has_critical_ambiguity = any(a.severity == Severity.CRITICAL for a in ambiguities)
        
        is_valid = soundness_passed and policy_passed and smt_passed and not has_critical_ambiguity
        
        error_count = sum(1 for c in all_checks if c.severity in [Severity.ERROR, Severity.CRITICAL])
        warning_count = sum(1 for c in all_checks if c.severity == Severity.WARNING) + len(ambiguities)
        
        if is_valid:
            if warning_count > 0:
                summary = f"Workflow verified with {warning_count} non-blocking warning(s)/flags. Ready for deployment."
            else:
                summary = "All formal graph soundness, authorization, and SMT constraints passed with zero errors."
        else:
            summary = f"Verification blocked with {error_count} error(s) and {warning_count} warning(s). Resolve blocking issues before deployment."

        return VerificationReport(
            is_valid=is_valid,
            soundness_passed=soundness_passed,
            authorization_passed=policy_passed,
            smt_passed=smt_passed,
            checks=all_checks,
            ambiguities=ambiguities,
            summary=summary,
            timestamp=datetime.utcnow().isoformat()
        )

    def verify(self, graph: WorkflowGraph) -> VerificationReport:
        return self.run_full_verification(graph)


# Convenience alias for Workflow Verifier
WorkflowVerifier = VerificationOrchestrator
