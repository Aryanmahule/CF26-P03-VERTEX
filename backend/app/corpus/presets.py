from typing import List, Dict, Any
from pydantic import BaseModel


class PolicyPreset(BaseModel):
    id: str
    title: str
    category: str
    description: str
    policy_text: str
    default_payload: Dict[str, Any]
    expected_findings: List[str]


def get_policy_presets() -> List[PolicyPreset]:
    return [
        PolicyPreset(
            id="procurement_benchmark",
            title="Procurement > $10k (Worked Example)",
            category="Finance & Procurement",
            description="The canonical benchmark policy from system design: demonstrates missing actor on verify vendor, generic 'Finance' role ambiguity, and sequential vs parallel inference.",
            policy_text="For any purchase over $10,000, verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.",
            default_payload={
                "purchase.amount": 18500.0,
                "vendor.verified": True,
                "budget.available": True
            },
            expected_findings=[
                "Missing actor on 'Verify the vendor'",
                "Generic role 'Finance' matches multiple roles",
                "Sequential vs parallel execution inference"
            ]
        ),
        PolicyPreset(
            id="high_value_limit_overflow",
            title="High-Value Capex ($100k) - RBAC Limit Breach",
            category="Authorization & RBAC",
            description="Demonstrates authorization checker detecting that Finance Manager's approval limit ($50k) is exceeded by a $100k threshold, requiring escalation to Finance Director.",
            policy_text="For any purchase over $100,000, verify the vendor, obtain finance manager approval, and create the procurement ticket.",
            default_payload={
                "purchase.amount": 125000.0,
                "vendor.verified": True
            },
            expected_findings=[
                "Approval Limit Exceeded: $100,000 exceeds Finance Manager ceiling ($50,000)",
                "Escalation recommendation to Finance Director"
            ]
        ),
        PolicyPreset(
            id="incident_sev1_parallel",
            title="SEV-1 Security Incident Triage (Parallel Fork)",
            category="IT & Information Security",
            description="Demonstrates parallel split/join execution for concurrent containment, notifications, and forensic capture.",
            policy_text="For any incident severity SEV-1, in parallel notify security lead, isolate compromised host, capture forensic memory dump, and obtain compliance officer signoff.",
            default_payload={
                "incident.severity": "SEV-1",
                "host.isolated": True
            },
            expected_findings=[
                "Parallel gateway synthesis",
                "Four-eyes compliance signoff"
            ]
        ),
        PolicyPreset(
            id="loan_underwriting_smt",
            title="Commercial Loan Underwriting (Multi-Constraint)",
            category="Banking & FinTech",
            description="Multi-variable mathematical constraints verified via Z3 SMT solver across loan amounts and credit scores.",
            policy_text="For any loan amount over $50,000, verify credit score, perform KYC compliance check, obtain finance director approval, and issue loan disbursement.",
            default_payload={
                "loan.amount": 75000.0,
                "loan.credit_score": 740,
                "vendor.verified": True
            },
            expected_findings=[
                "Multi-variable guard extraction",
                "Z3 satisfiability proof"
            ]
        ),
        PolicyPreset(
            id="travel_reimbursement",
            title="Corporate Travel Expense Reimbursement",
            category="Human Resources & Ops",
            description="Standard corporate travel expense flow with department manager oversight and reimbursement disbursement.",
            policy_text="For any travel cost over $5,000, verify receipts, check budget, obtain department manager approval, and issue reimbursement payment.",
            default_payload={
                "travel.cost": 6200.0,
                "receipts.attached": True
            },
            expected_findings=[
                "Department manager limit check ($15,000 ceiling)",
                "External payment gateway step"
            ]
        ),
        PolicyPreset(
            id="contradictory_policy_dead_path",
            title="Contradictory Rule (Z3 SMT Dead Path Demo)",
            category="Formal Verification Demo",
            description="Intentionally contradictory policy (amount > 50000 AND amount < 10000) that Z3 mathematically proves impossible.",
            policy_text="For any purchase over $50,000, where purchase amount is under $10,000, obtain finance approval and create the procurement ticket.",
            default_payload={
                "purchase.amount": 25000.0
            },
            expected_findings=[
                "Z3 SMT Solver: Mathematically Unsatisfiable (Dead) Path",
                "Contradictory boundary condition flag"
            ]
        )
    ]
