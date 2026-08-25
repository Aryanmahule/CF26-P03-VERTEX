from typing import List, Dict, Any, Optional
from app.ir.models import (
    WorkflowGraph, VerificationReport, VerificationCheckResult,
    AmbiguityFinding, Severity
)


class DiagnosticCard:
    def __init__(
        self,
        id: str,
        title: str,
        category: str,
        severity: Severity,
        source_text: str,
        source_span: tuple[int, int],
        explanation: str,
        remediation: str,
        node_id: Optional[str] = None,
        edge_id: Optional[str] = None,
        quick_fixes: List[Dict[str, Any]] = None
    ):
        self.id = id
        self.title = title
        self.category = category
        self.severity = severity
        self.source_text = source_text
        self.source_span = source_span
        self.explanation = explanation
        self.remediation = remediation
        self.node_id = node_id
        self.edge_id = edge_id
        self.quick_fixes = quick_fixes or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "severity": self.severity.value,
            "source_text": self.source_text,
            "source_span": list(self.source_span),
            "explanation": self.explanation,
            "remediation": self.remediation,
            "node_id": self.node_id,
            "edge_id": self.edge_id,
            "quick_fixes": self.quick_fixes
        }


class ExplanationGenerator:
    def __init__(self):
        pass

    def generate_diagnostics(self, report: VerificationReport, graph: WorkflowGraph) -> List[Dict[str, Any]]:
        cards: List[DiagnosticCard] = []

        # 1. Process Ambiguities
        for amb in report.ambiguities:
            fixes = [
                {
                    "option_id": opt.id,
                    "label": opt.label,
                    "description": opt.description,
                    "action_type": opt.action_type,
                    "payload": opt.payload
                }
                for opt in amb.candidate_options
            ]
            cards.append(DiagnosticCard(
                id=amb.id,
                title=amb.title,
                category=amb.category.value,
                severity=amb.severity,
                source_text=amb.source_text or (graph.policy_text[amb.source_span[0]:amb.source_span[1]] if amb.source_span != (0, 0) else ""),
                source_span=amb.source_span,
                explanation=amb.description,
                remediation=amb.suggestion,
                node_id=amb.node_id,
                edge_id=amb.edge_id,
                quick_fixes=fixes
            ))

        # 2. Process Failed or Warning Verification Checks
        for check in report.checks:
            if not check.passed or check.severity in [Severity.WARNING, Severity.ERROR, Severity.CRITICAL]:
                src_text = check.source_text
                if not src_text and check.node_id:
                    node = graph.get_node(check.node_id)
                    if node:
                        src_text = node.source_text or node.label
                
                cards.append(DiagnosticCard(
                    id=f"check_{check.checker_name}_{check.title.replace(' ', '_').lower()}",
                    title=check.title,
                    category=check.category.value,
                    severity=check.severity,
                    source_text=src_text,
                    source_span=check.source_span,
                    explanation=check.details,
                    remediation=check.suggestion or "Review policy definition or adjust graph topology.",
                    node_id=check.node_id,
                    edge_id=check.edge_id,
                    quick_fixes=[]
                ))

        return [c.to_dict() for c in cards]
