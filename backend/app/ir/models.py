from enum import Enum
from typing import Optional, List, Dict, Any, Tuple
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    START = "start"
    TASK = "task"                 # an action performed by an actor/system
    DECISION = "decision"         # branch point (if/else, switch)
    APPROVAL = "approval"         # requires sign-off from a role
    PARALLEL_SPLIT = "parallel_split"
    PARALLEL_JOIN = "parallel_join"
    EXTERNAL_CALL = "external_call"  # e.g. "create the procurement ticket"
    END = "end"


class TargetFormat(str, Enum):
    BPMN = "bpmn"
    TEMPORAL_TS = "temporal_ts"
    TEMPORAL_PY = "temporal_py"
    XSTATE = "xstate"
    MERMAID = "mermaid"


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class FindingCategory(str, Enum):
    MISSING_ACTOR = "missing_actor"
    UNRESOLVED_ROLE = "unresolved_role"
    UNDERSPECIFIED_GUARD = "underspecified_guard"
    ORDER_AMBIGUITY = "order_ambiguity"
    POLYSEMY = "polysemy"
    GRAPH_SOUNDNESS = "graph_soundness"
    AUTHORIZATION = "authorization"
    SMT_UNSATISFIABLE = "smt_unsatisfiable"
    SMT_INCOMPLETE_GATE = "smt_incomplete_gate"
    SMT_OVERLAPPING_GUARDS = "smt_overlapping_guards"
    SEPARATION_OF_DUTY = "separation_of_duty"
    LIMIT_EXCEEDED = "limit_exceeded"


class Actor(BaseModel):
    role: str                     # e.g. "Finance Manager"
    scope: Optional[str] = None   # e.g. "budget < $50,000"
    resolved_entity_id: Optional[str] = None  # linked to org chart/IAM
    department: Optional[str] = None
    confidence: float = 1.0


class Guard(BaseModel):
    expression: str               # normalized boolean expression, e.g. "purchase.amount > 10000"
    source_text: str = ""         # original NL fragment this was derived from
    variables: List[str] = Field(default_factory=list)
    operator: Optional[str] = None # '>', '<=', '==', '!=', etc.
    left_operand: Optional[str] = None
    right_operand: Optional[Any] = None


class WorkflowNode(BaseModel):
    id: str
    type: NodeType
    label: str
    actor: Optional[Actor] = None
    required_authorization: Optional[str] = None   # permission needed to execute e.g. "approve_procurement"
    preconditions: List[Guard] = Field(default_factory=list)
    source_span: Tuple[int, int] = (0, 0)   # char offsets (start, end) into original policy text
    source_text: str = ""
    confidence: float = 1.0              # NLP extraction confidence
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    guard: Optional[Guard] = None   # condition to traverse this edge
    source_text: str = ""
    source_span: Tuple[int, int] = (0, 0)
    confidence: float = 1.0


class GlossaryItem(BaseModel):
    term: str
    data_type: str = "string"  # "number", "boolean", "string", "currency"
    description: str = ""
    allowed_values: Optional[List[str]] = None
    default_threshold: Optional[float] = None
    unit: Optional[str] = None


class WorkflowGraph(BaseModel):
    id: str = "workflow_1"
    name: str = "Compiled Workflow"
    version: str = "1.0.0"
    policy_text: str = ""
    nodes: List[WorkflowNode] = Field(default_factory=list)
    edges: List[WorkflowEdge] = Field(default_factory=list)
    roles: List[Actor] = Field(default_factory=list)
    glossary: Dict[str, GlossaryItem] = Field(default_factory=dict)        # canonicalized term definitions
    provenance: Dict[str, str] = Field(default_factory=dict)      # node/edge id -> original sentence
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def get_node(self, node_id: str) -> Optional[WorkflowNode]:
        for n in self.nodes:
            if n.id == node_id:
                return n
        return None

    def get_outgoing_edges(self, node_id: str) -> List[WorkflowEdge]:
        return [e for e in self.edges if e.source == node_id]

    def get_incoming_edges(self, node_id: str) -> List[WorkflowEdge]:
        return [e for e in self.edges if e.target == node_id]


# Primary Workflow Intermediate Representation Schema
WorkflowIR = WorkflowGraph


class AmbiguityOption(BaseModel):
    id: str
    label: str
    description: str
    action_type: str  # "set_actor", "set_guard", "make_parallel", "make_sequential", "set_limit"
    payload: Dict[str, Any] = Field(default_factory=dict)


class AmbiguityFinding(BaseModel):
    id: str
    category: FindingCategory
    severity: Severity = Severity.WARNING
    node_id: Optional[str] = None
    edge_id: Optional[str] = None
    source_span: Tuple[int, int] = (0, 0)
    source_text: str = ""
    title: str
    description: str
    suggestion: str
    candidate_options: List[AmbiguityOption] = Field(default_factory=list)
    resolved: bool = False
    chosen_option_id: Optional[str] = None


class VerificationCheckResult(BaseModel):
    passed: bool
    checker_name: str
    title: str
    details: str
    category: FindingCategory
    severity: Severity
    node_id: Optional[str] = None
    edge_id: Optional[str] = None
    source_span: Tuple[int, int] = (0, 0)
    source_text: str = ""
    suggestion: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VerificationReport(BaseModel):
    is_valid: bool = True
    soundness_passed: bool = True
    authorization_passed: bool = True
    smt_passed: bool = True
    checks: List[VerificationCheckResult] = Field(default_factory=list)
    ambiguities: List[AmbiguityFinding] = Field(default_factory=list)
    summary: str = ""
    timestamp: str = ""


class CompiledArtifact(BaseModel):
    format: TargetFormat
    filename: str
    content: str
    language: str
    description: str


class SimulationStep(BaseModel):
    step_number: int
    current_node_id: str
    node_label: str
    node_type: NodeType
    actor: Optional[str] = None
    action_taken: str
    evaluated_guards: List[Dict[str, Any]] = Field(default_factory=list)
    variable_state: Dict[str, Any] = Field(default_factory=dict)
    traversed_edge_id: Optional[str] = None
    timestamp: str = ""


class SimulationResult(BaseModel):
    success: bool
    status: str  # "completed", "blocked_waiting_approval", "error_deadlock", "in_progress"
    final_node_id: Optional[str] = None
    trace: List[SimulationStep] = Field(default_factory=list)
    final_variables: Dict[str, Any] = Field(default_factory=dict)
    message: str = ""
