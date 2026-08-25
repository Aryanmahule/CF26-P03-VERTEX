import uuid
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ir.models import (
    WorkflowGraph, VerificationReport, TargetFormat,
    AmbiguityFinding, CompiledArtifact, SimulationResult
)
from app.org.org_model import OrgChart, get_default_org_chart, get_default_glossary
from app.parser.pipeline import ParserPipeline
from app.ambiguity.detector import AmbiguityDetector, apply_ambiguity_resolution
from app.verifier.orchestrator import VerificationOrchestrator
from app.explainer.explainer import ExplanationGenerator
from app.compiler.compiler_service import CompilerService
from app.runtime.simulator import WorkflowSimulator
from app.corpus.presets import get_policy_presets, PolicyPreset
from app.rules.rules_manager import get_rules_manager, RulesConfig

router = APIRouter()

# Shared state instances
rules_manager = get_rules_manager()
org_chart_instance = get_default_org_chart()
glossary_instance = get_default_glossary()
parser_instance = ParserPipeline(org_chart_instance, glossary_instance)
verifier_instance = VerificationOrchestrator(org_chart_instance, rules_manager.get_rules())
explainer_instance = ExplanationGenerator()
compiler_instance = CompilerService()
simulator_instance = WorkflowSimulator()


# Request / Response Schemas
class ParseRequest(BaseModel):
    policy_text: str


class ParseResponse(BaseModel):
    graph: WorkflowGraph
    report: VerificationReport
    diagnostics: List[Dict[str, Any]]


class AmbiguityResolveRequest(BaseModel):
    graph: WorkflowGraph
    finding_id: str
    chosen_option_id: str


class CompileRequest(BaseModel):
    policy_text: Optional[str] = None
    graph: Optional[WorkflowGraph] = None
    target_format: Optional[TargetFormat] = None


class DeployRequest(BaseModel):
    graph: WorkflowGraph
    target_format: Optional[TargetFormat] = None
    environment: str = "production"


class DeployResponse(BaseModel):
    status: str
    deployment_id: str
    message: str
    verified: bool
    artifacts: Dict[str, Any]


class SimulationRequest(BaseModel):
    graph: WorkflowGraph
    payload: Dict[str, Any]
    auto_approve: bool = True
    max_steps: int = 40


@router.get("/presets", response_model=List[PolicyPreset])
def list_presets():
    return get_policy_presets()


@router.get("/org")
def get_organization_model():
    return {
        "org_chart": org_chart_instance,
        "glossary": glossary_instance
    }


@router.get("/rules", response_model=RulesConfig)
def get_rules():
    return rules_manager.get_rules()


@router.post("/rules", response_model=RulesConfig)
def update_rules(rules: RulesConfig):
    updated = rules_manager.update_rules(rules)
    verifier_instance.reload_rules(updated)
    return updated


@router.post("/parse", response_model=ParseResponse)
def parse_policy(req: ParseRequest):
    if not req.policy_text or not req.policy_text.strip():
        raise HTTPException(status_code=400, detail="Policy text cannot be empty.")
        
    # 1. Parse policy to draft IR
    graph = parser_instance.parse(req.policy_text)
    
    # 2. Run verification & ambiguity detection
    report = verifier_instance.run_full_verification(graph)
    
    # 3. Generate diagnostic explanations
    diagnostics = explainer_instance.generate_diagnostics(report, graph)
    
    return ParseResponse(
        graph=graph,
        report=report,
        diagnostics=diagnostics
    )


@router.post("/verify", response_model=ParseResponse)
def verify_workflow(graph: WorkflowGraph):
    report = verifier_instance.run_full_verification(graph)
    diagnostics = explainer_instance.generate_diagnostics(report, graph)
    return ParseResponse(
        graph=graph,
        report=report,
        diagnostics=diagnostics
    )


@router.post("/ambiguity/resolve", response_model=ParseResponse)
def resolve_ambiguity(req: AmbiguityResolveRequest):
    updated_graph = apply_ambiguity_resolution(
        graph=req.graph,
        finding_id=req.finding_id,
        chosen_option_id=req.chosen_option_id,
        org_chart=org_chart_instance
    )
    report = verifier_instance.run_full_verification(updated_graph)
    diagnostics = explainer_instance.generate_diagnostics(report, updated_graph)
    return ParseResponse(
        graph=updated_graph,
        report=report,
        diagnostics=diagnostics
    )


@router.post("/compile")
def compile_workflow(req: CompileRequest):
    graph = req.graph
    report = None

    if req.policy_text and req.policy_text.strip():
        from app.parser.gemini_parser import compile_policy_with_gemini
        try:
            graph = compile_policy_with_gemini(req.policy_text)
        except Exception:
            # Fallback to local deterministic pipeline if Gemini key is unset/errored
            graph = parser_instance.parse(req.policy_text)
        report = verifier_instance.run_full_verification(graph)
    
    if graph is None:
        raise HTTPException(status_code=400, detail="Either policy_text or graph must be provided.")

    if req.target_format:
        artifact = compiler_instance.compile(graph, req.target_format)
        response_data: Dict[str, Any] = {"artifacts": {req.target_format.value: artifact}}
    else:
        artifacts = compiler_instance.compile_all(graph)
        response_data = {"artifacts": {k.value: v for k, v in artifacts.items()}}

    if report is not None:
        response_data["graph"] = graph
        response_data["report"] = report

    return response_data


@router.post("/deploy", response_model=DeployResponse)
def deploy_workflow(req: DeployRequest):
    report = verifier_instance.run_full_verification(req.graph)
    
    # Check for blocking issues
    if not report.is_valid:
        error_checks = [c.title for c in report.checks if c.severity in ["error", "critical"]]
        raise HTTPException(
            status_code=400,
            detail=f"Workflow deployment blocked by {len(error_checks)} critical/error verification issue(s): {', '.join(error_checks[:3])}"
        )
        
    artifacts = compiler_instance.compile_all(req.graph)
    deployment_id = f"dep_{uuid.uuid4().hex[:12]}"
    
    return DeployResponse(
        status="deployed",
        deployment_id=deployment_id,
        message=f"Workflow '{req.graph.name}' successfully verified and deployed to {req.environment} target environment.",
        verified=True,
        artifacts={k.value: v for k, v in artifacts.items()}
    )


@router.post("/simulate", response_model=SimulationResult)
def simulate_workflow(req: SimulationRequest):
    result = simulator_instance.run_simulation(
        graph=req.graph,
        initial_payload=req.payload,
        max_steps=req.max_steps,
        auto_approve=req.auto_approve
    )
    return result
