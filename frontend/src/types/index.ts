export type NodeType =
  | 'start'
  | 'task'
  | 'decision'
  | 'approval'
  | 'parallel_split'
  | 'parallel_join'
  | 'external_call'
  | 'end';

export type TargetFormat =
  | 'bpmn'
  | 'temporal_ts'
  | 'temporal_py'
  | 'xstate'
  | 'mermaid';

export type Severity = 'info' | 'warning' | 'error' | 'critical';

export type FindingCategory =
  | 'missing_actor'
  | 'unresolved_role'
  | 'underspecified_guard'
  | 'order_ambiguity'
  | 'polysemy'
  | 'graph_soundness'
  | 'authorization'
  | 'smt_unsatisfiable'
  | 'smt_incomplete_gate'
  | 'smt_overlapping_guards'
  | 'separation_of_duty'
  | 'limit_exceeded';

export type LayoutMode = 'tree' | 'radial';

export interface Actor {
  role: string;
  scope?: string;
  resolved_entity_id?: string;
  department?: string;
  confidence?: number;
}

export interface Guard {
  expression: string;
  source_text?: string;
  variables?: string[];
  operator?: string;
  left_operand?: string;
  right_operand?: any;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  actor?: Actor;
  required_authorization?: string;
  preconditions?: Guard[];
  source_span: [number, number];
  source_text?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  guard?: Guard;
  source_text?: string;
  source_span?: [number, number];
  confidence?: number;
}

export interface GlossaryItem {
  term: string;
  data_type: string;
  description: string;
  allowed_values?: string[];
  default_threshold?: number;
  unit?: string;
}

export interface WorkflowGraph {
  id: string;
  name: string;
  version: string;
  policy_text: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  roles: Actor[];
  glossary?: Record<string, GlossaryItem>;
  provenance?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface AmbiguityOption {
  id: string;
  label: string;
  description: string;
  action_type: string;
  payload: Record<string, any>;
}

export interface AmbiguityFinding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  node_id?: string;
  edge_id?: string;
  source_span: [number, number];
  source_text: string;
  title: string;
  description: string;
  suggestion: string;
  candidate_options: AmbiguityOption[];
  resolved?: boolean;
  chosen_option_id?: string;
}

export interface VerificationCheckResult {
  passed: boolean;
  checker_name: string;
  title: string;
  details: string;
  category: FindingCategory;
  severity: Severity;
  node_id?: string;
  edge_id?: string;
  source_span?: [number, number];
  source_text?: string;
  suggestion?: string;
  metadata?: Record<string, any>;
}

export interface VerificationReport {
  is_valid: boolean;
  soundness_passed: boolean;
  authorization_passed: boolean;
  smt_passed: boolean;
  checks: VerificationCheckResult[];
  ambiguities: AmbiguityFinding[];
  summary: string;
  timestamp: string;
}

export interface DiagnosticItem {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  source_text: string;
  source_span: [number, number];
  explanation: string;
  remediation: string;
  node_id?: string;
  edge_id?: string;
  quick_fixes?: Array<{
    option_id: string;
    label: string;
    description: string;
    action_type: string;
    payload: Record<string, any>;
  }>;
}

export interface CompiledArtifact {
  format: TargetFormat;
  filename: string;
  content: string;
  language: string;
  description: string;
}

export interface SimulationStep {
  step_number: number;
  current_node_id: string;
  node_label: string;
  node_type: NodeType;
  actor?: string;
  action_taken: string;
  evaluated_guards?: Array<{ guard: string; passed: boolean; details: string }>;
  variable_state?: Record<string, any>;
  traversed_edge_id?: string;
  timestamp?: string;
}

export interface SimulationResult {
  success: boolean;
  status: string;
  final_node_id?: string;
  trace: SimulationStep[];
  final_variables: Record<string, any>;
  message: string;
}

export interface PolicyPreset {
  id: string;
  title: string;
  category: string;
  description: string;
  policy_text: string;
  default_payload: Record<string, any>;
  expected_findings: string[];
}

export interface RoleDefinition {
  id: string;
  name: string;
  department: string;
  reports_to?: string;
  approval_limit?: number;
  permissions: string[];
  description: string;
  aliases: string[];
}

export interface OrgChart {
  id: string;
  name: string;
  roles: Record<string, RoleDefinition>;
}

// Rules Configuration Types
export interface SegregationOfDutyRule {
  id: string;
  name: string;
  action_a: string;
  action_b: string;
  description: string;
}

export interface SpendTier {
  tier: string;
  min_amount: number;
  max_amount: number;
  required_role: string;
  required_permission: string;
}

export interface RoleResolutionConfig {
  unresolved_policy: string;
  role_dictionary: Record<string, string>;
}

export interface AuthorizationRulesConfig {
  segregation_of_duties: SegregationOfDutyRule[];
  spend_threshold_tiers: SpendTier[];
}

export interface AmbiguityConfidenceConfig {
  blocking_confidence_threshold: number;
  warning_confidence_threshold: number;
  vague_terms: string[];
}

export interface GraphValidityConfig {
  require_single_start: boolean;
  require_terminal_end: boolean;
  disallow_unbounded_cycles: boolean;
  max_retry_limit_default: number;
  require_precondition_chain: boolean;
}

export interface BranchCompletenessConfig {
  require_dual_branch_on_decision: boolean;
  allow_explicit_default_branch: boolean;
}

export interface RulesConfig {
  version: string;
  updated_at: string;
  role_resolution: RoleResolutionConfig;
  authorization: AuthorizationRulesConfig;
  ambiguity_and_confidence: AmbiguityConfidenceConfig;
  graph_validity: GraphValidityConfig;
  branch_completeness: BranchCompletenessConfig;
}

export interface DeployRequest {
  graph: WorkflowGraph;
  target_format?: TargetFormat;
  environment?: string;
}

export interface DeployResponse {
  status: string;
  deployment_id: string;
  message: string;
  verified: boolean;
  artifacts: Record<string, CompiledArtifact>;
}
