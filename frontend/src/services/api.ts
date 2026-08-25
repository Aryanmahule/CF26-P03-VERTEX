import {
  WorkflowGraph,
  VerificationReport,
  DiagnosticItem,
  PolicyPreset,
  TargetFormat,
  CompiledArtifact,
  SimulationResult,
  OrgChart,
  GlossaryItem,
  RulesConfig,
  DeployRequest,
  DeployResponse
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

export interface ParseResponse {
  graph: WorkflowGraph;
  report: VerificationReport;
  diagnostics: DiagnosticItem[];
}

export interface CompileResponse {
  artifacts: Record<string, CompiledArtifact>;
  graph?: WorkflowGraph;
  report?: VerificationReport;
}

export interface OrgModelResponse {
  org_chart: OrgChart;
  glossary: Record<string, GlossaryItem>;
}

export const api = {
  async fetchPresets(): Promise<PolicyPreset[]> {
    const res = await fetch(`${API_BASE_URL}/presets`);
    if (!res.ok) throw new Error(`Failed to fetch presets: ${res.statusText}`);
    return res.json();
  },

  async fetchOrgModel(): Promise<OrgModelResponse> {
    const res = await fetch(`${API_BASE_URL}/org`);
    if (!res.ok) throw new Error(`Failed to fetch org model: ${res.statusText}`);
    return res.json();
  },

  async fetchRules(): Promise<RulesConfig> {
    const res = await fetch(`${API_BASE_URL}/rules`);
    if (!res.ok) throw new Error(`Failed to fetch rules: ${res.statusText}`);
    return res.json();
  },

  async updateRules(rules: RulesConfig): Promise<RulesConfig> {
    const res = await fetch(`${API_BASE_URL}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rules)
    });
    if (!res.ok) throw new Error(`Failed to update rules: ${res.statusText}`);
    return res.json();
  },

  async parsePolicy(policy_text: string): Promise<ParseResponse> {
    const res = await fetch(`${API_BASE_URL}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy_text })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to parse policy');
    }
    return res.json();
  },

  async verifyWorkflow(graph: WorkflowGraph): Promise<ParseResponse> {
    const res = await fetch(`${API_BASE_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graph)
    });
    if (!res.ok) throw new Error('Failed to verify workflow');
    return res.json();
  },

  async resolveAmbiguity(
    graph: WorkflowGraph,
    finding_id: string,
    chosen_option_id: string
  ): Promise<ParseResponse> {
    const res = await fetch(`${API_BASE_URL}/ambiguity/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph,
        finding_id,
        chosen_option_id
      })
    });
    if (!res.ok) throw new Error('Failed to apply resolution');
    return res.json();
  },

  async compileWorkflow(
    graph: WorkflowGraph,
    target_format?: TargetFormat
  ): Promise<CompileResponse> {
    const res = await fetch(`${API_BASE_URL}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph,
        target_format
      })
    });
    if (!res.ok) throw new Error('Failed to compile workflow');
    return res.json();
  },

  async deployWorkflow(req: DeployRequest): Promise<DeployResponse> {
    const res = await fetch(`${API_BASE_URL}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Workflow deployment failed verification.');
    }
    return res.json();
  },

  async simulateWorkflow(
    graph: WorkflowGraph,
    payload: Record<string, any>,
    autoApprove: boolean = true,
    maxSteps: number = 40
  ): Promise<SimulationResult> {
    const res = await fetch(`${API_BASE_URL}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph,
        payload,
        auto_approve: autoApprove,
        max_steps: maxSteps
      })
    });
    if (!res.ok) throw new Error('Failed to execute simulation step');
    return res.json();
  }
};
