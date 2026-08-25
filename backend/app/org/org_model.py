from typing import Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field
from app.ir.models import GlossaryItem


class RoleDefinition(BaseModel):
    id: str
    name: str
    department: str
    reports_to: Optional[str] = None
    approval_limit: Optional[float] = None  # in USD, None = unlimited or N/A
    permissions: List[str] = Field(default_factory=list)
    description: str = ""
    aliases: List[str] = Field(default_factory=list)  # e.g., ["Finance", "Finance Lead"]


class OrgChart(BaseModel):
    id: str = "default_org"
    name: str = "Enterprise Global Corp"
    roles: Dict[str, RoleDefinition] = Field(default_factory=dict)
    
    def find_role(self, role_query: str) -> Optional[RoleDefinition]:
        query_norm = role_query.strip().lower()
        # Direct match by id or name
        for r_id, r_def in self.roles.items():
            if r_id.lower() == query_norm or r_def.name.lower() == query_norm:
                return r_def
        # Match by aliases
        for r_def in self.roles.values():
            for alias in r_def.aliases:
                if alias.lower() == query_norm:
                    return r_def
        # Substring / fuzzy match
        for r_def in self.roles.values():
            if query_norm in r_def.name.lower() or any(query_norm in a.lower() for a in r_def.aliases):
                return r_def
        return None

    def get_candidate_roles(self, query: str) -> List[RoleDefinition]:
        query_norm = query.strip().lower()
        candidates = []
        for r_def in self.roles.values():
            if (query_norm in r_def.name.lower() or 
                query_norm in r_def.department.lower() or 
                any(query_norm in a.lower() for a in r_def.aliases)):
                candidates.append(r_def)
        return candidates

    def has_permission(self, role_id_or_name: str, permission: str) -> bool:
        role = self.find_role(role_id_or_name)
        if not role:
            return False
        return permission in role.permissions or "*" in role.permissions

    def check_approval_limit(self, role_id_or_name: str, amount: float) -> Tuple[bool, str]:
        role = self.find_role(role_id_or_name)
        if not role:
            return False, f"Role '{role_id_or_name}' not found in org chart."
        if role.approval_limit is None:
            return True, "No limit restriction on this role."
        if amount <= role.approval_limit:
            return True, f"Amount ${amount:,.2f} is within approval limit of ${role.approval_limit:,.2f}."
        return False, f"Amount ${amount:,.2f} exceeds {role.name}'s approval ceiling of ${role.approval_limit:,.2f}."

    def get_escalation_role(self, current_role_id: str, required_amount: float) -> Optional[RoleDefinition]:
        current = self.roles.get(current_role_id)
        while current and current.reports_to:
            parent = self.roles.get(current.reports_to)
            if parent:
                if parent.approval_limit is None or parent.approval_limit >= required_amount:
                    return parent
                current = parent
            else:
                break
        return None


# Helper tuple
Tuple_Result = tuple[bool, str]


def get_default_org_chart() -> OrgChart:
    roles = {
        "employee": RoleDefinition(
            id="employee",
            name="Employee",
            department="General",
            approval_limit=0.0,
            permissions=["submit_request", "attach_receipt", "initiate_workflow"],
            aliases=["Staff", "Requester", "Applicant", "Submitter"]
        ),
        "team_lead": RoleDefinition(
            id="team_lead",
            name="Team Lead",
            department="Operations",
            reports_to="dept_manager",
            approval_limit=5000.0,
            permissions=["approve_level_1", "verify_vendor", "check_budget", "approve_travel"],
            aliases=["Lead", "Supervisor"]
        ),
        "dept_manager": RoleDefinition(
            id="dept_manager",
            name="Department Manager",
            department="Operations",
            reports_to="finance_director",
            approval_limit=15000.0,
            permissions=["approve_procurement", "approve_expense", "check_budget", "approve_level_1", "approve_level_2"],
            aliases=["Manager", "Line Manager"]
        ),
        "procurement_officer": RoleDefinition(
            id="procurement_officer",
            name="Procurement Officer",
            department="Procurement",
            reports_to="finance_director",
            approval_limit=25000.0,
            permissions=["verify_vendor", "create_procurement_ticket", "issue_po", "negotiate_contract"],
            aliases=["Procurement", "Purchaser", "Buyer"]
        ),
        "finance_manager": RoleDefinition(
            id="finance_manager",
            name="Finance Manager",
            department="Finance",
            reports_to="finance_director",
            approval_limit=50000.0,
            permissions=["approve_procurement", "approve_expense", "check_budget", "issue_payment", "audit_financials"],
            aliases=["Finance", "Finance Lead", "Accounts Manager"]
        ),
        "finance_director": RoleDefinition(
            id="finance_director",
            name="Finance Director",
            department="Finance",
            reports_to="cfo",
            approval_limit=250000.0,
            permissions=["approve_procurement", "approve_expense", "override_budget", "issue_payment", "sign_contract"],
            aliases=["Director of Finance", "Head of Finance"]
        ),
        "cfo": RoleDefinition(
            id="cfo",
            name="Chief Financial Officer (CFO)",
            department="Executive",
            reports_to="ceo",
            approval_limit=1000000.0,
            permissions=["*"],
            aliases=["CFO", "Finance VP"]
        ),
        "ceo": RoleDefinition(
            id="ceo",
            name="Chief Executive Officer (CEO)",
            department="Executive",
            reports_to=None,
            approval_limit=None,
            permissions=["*"],
            aliases=["CEO", "President", "Executive Director"]
        ),
        "compliance_officer": RoleDefinition(
            id="compliance_officer",
            name="Compliance Officer",
            department="Legal & Compliance",
            reports_to="general_counsel",
            approval_limit=None,
            permissions=["verify_compliance", "kyc_check", "aml_audit", "legal_review", "verify_vendor"],
            aliases=["Compliance", "Risk Analyst", "Auditor"]
        ),
        "security_lead": RoleDefinition(
            id="security_lead",
            name="Security Lead",
            department="Information Security",
            reports_to="ciso",
            approval_limit=None,
            permissions=["grant_access", "revoke_access", "incident_triage", "security_audit"],
            aliases=["Security", "InfoSec Lead", "Security Admin"]
        ),
        "system_admin": RoleDefinition(
            id="system_admin",
            name="System Administrator",
            department="IT",
            reports_to="it_director",
            approval_limit=None,
            permissions=["provision_account", "execute_external_call", "deploy_resource"],
            aliases=["SysAdmin", "IT Admin", "DevOps"]
        ),
    }
    return OrgChart(roles=roles)


def get_default_glossary() -> Dict[str, GlossaryItem]:
    return {
        "purchase.amount": GlossaryItem(
            term="purchase.amount",
            data_type="currency",
            unit="USD",
            description="The total monetary cost of the requested purchase/procurement"
        ),
        "budget.amount": GlossaryItem(
            term="budget.amount",
            data_type="currency",
            unit="USD",
            description="The requested budget allocation"
        ),
        "budget.limit": GlossaryItem(
            term="budget.limit",
            data_type="currency",
            unit="USD",
            description="The maximum allowed spending limit allocated to the department"
        ),
        "vendor.verified": GlossaryItem(
            term="vendor.verified",
            data_type="boolean",
            description="Whether the vendor has completed KYC/compliance verification"
        ),
        "vendor.risk_score": GlossaryItem(
            term="vendor.risk_score",
            data_type="number",
            description="Risk rating from 0 (low) to 100 (high)"
        ),
        "travel.cost": GlossaryItem(
            term="travel.cost",
            data_type="currency",
            unit="USD",
            description="Total cost of travel accommodation and flights"
        ),
        "travel.is_international": GlossaryItem(
            term="travel.is_international",
            data_type="boolean",
            description="True if travel destination is outside home country"
        ),
        "incident.severity": GlossaryItem(
            term="incident.severity",
            data_type="string",
            allowed_values=["SEV-1", "SEV-2", "SEV-3", "SEV-4"],
            description="Severity level of the IT/Security incident"
        ),
        "access.is_production": GlossaryItem(
            term="access.is_production",
            data_type="boolean",
            description="Whether the requested permission includes access to production environments"
        ),
        "loan.amount": GlossaryItem(
            term="loan.amount",
            data_type="currency",
            unit="USD",
            description="Principal amount requested for the loan"
        ),
        "loan.credit_score": GlossaryItem(
            term="loan.credit_score",
            data_type="number",
            description="FICO credit score of the applicant (300 - 850)"
        ),
        "loan.dti_ratio": GlossaryItem(
            term="loan.dti_ratio",
            data_type="number",
            description="Debt to income percentage ratio (e.g., 36.5 for 36.5%)"
        )
    }
