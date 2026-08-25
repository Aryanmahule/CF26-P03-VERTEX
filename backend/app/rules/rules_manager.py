import json
import os
import threading
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

RULES_FILE_PATH = os.path.join(os.path.dirname(__file__), "rules_config.json")


class SegregationOfDutyRule(BaseModel):
    id: str
    name: str
    action_a: str
    action_b: str
    description: str


class SpendTier(BaseModel):
    tier: str
    min_amount: float
    max_amount: float
    required_role: str
    required_permission: str


class RoleResolutionConfig(BaseModel):
    unresolved_policy: str = "mark_unresolved_and_flag"
    role_dictionary: Dict[str, str] = Field(default_factory=dict)


class AuthorizationRulesConfig(BaseModel):
    segregation_of_duties: List[SegregationOfDutyRule] = Field(default_factory=list)
    spend_threshold_tiers: List[SpendTier] = Field(default_factory=list)


class AmbiguityConfidenceConfig(BaseModel):
    blocking_confidence_threshold: float = 0.60
    warning_confidence_threshold: float = 0.85
    vague_terms: List[str] = Field(default_factory=list)


class GraphValidityConfig(BaseModel):
    require_single_start: bool = True
    require_terminal_end: bool = True
    disallow_unbounded_cycles: bool = True
    max_retry_limit_default: int = 5
    require_precondition_chain: bool = True


class BranchCompletenessConfig(BaseModel):
    require_dual_branch_on_decision: bool = True
    allow_explicit_default_branch: bool = True


class RulesConfig(BaseModel):
    version: str = "1.0.0"
    updated_at: str = ""
    role_resolution: RoleResolutionConfig = Field(default_factory=RoleResolutionConfig)
    authorization: AuthorizationRulesConfig = Field(default_factory=AuthorizationRulesConfig)
    ambiguity_and_confidence: AmbiguityConfidenceConfig = Field(default_factory=AmbiguityConfidenceConfig)
    graph_validity: GraphValidityConfig = Field(default_factory=GraphValidityConfig)
    branch_completeness: BranchCompletenessConfig = Field(default_factory=BranchCompletenessConfig)


class RulesManager:
    """Thread-safe manager for loading, querying, and updating rules_config.json."""
    _instance: Optional["RulesManager"] = None
    _lock = threading.Lock()

    def __init__(self, file_path: str = RULES_FILE_PATH):
        self.file_path = file_path
        self._rules: RulesConfig = self._load()

    def _load(self) -> RulesConfig:
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return RulesConfig.model_validate(data)
            except Exception:
                pass
        return RulesConfig()

    def get_rules(self) -> RulesConfig:
        with self._lock:
            return self._rules

    def update_rules(self, new_rules: RulesConfig) -> RulesConfig:
        with self._lock:
            self._rules = new_rules
            # Save to disk
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self._rules.model_dump(), f, indent=2)
            return self._rules

    def find_role_id(self, keyword: str) -> Optional[str]:
        rules = self.get_rules()
        norm = keyword.strip().lower()
        return rules.role_resolution.role_dictionary.get(norm)

    def is_vague_term(self, term: str) -> bool:
        rules = self.get_rules()
        norm = term.strip().lower()
        return any(vague in norm for vague in rules.ambiguity_and_confidence.vague_terms)

    def get_spend_tier(self, amount: float) -> Optional[SpendTier]:
        rules = self.get_rules()
        for tier in rules.authorization.spend_threshold_tiers:
            if tier.min_amount <= amount <= tier.max_amount:
                return tier
        return None


_rules_manager_singleton: Optional[RulesManager] = None


def get_rules_manager() -> RulesManager:
    global _rules_manager_singleton
    if _rules_manager_singleton is None:
        _rules_manager_singleton = RulesManager()
    return _rules_manager_singleton
