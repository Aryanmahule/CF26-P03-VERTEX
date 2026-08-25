import pytest
from app.ir.models import (
    WorkflowGraph, WorkflowNode, WorkflowEdge, NodeType, Actor, Guard, TargetFormat
)
from app.org.org_model import get_default_org_chart, get_default_glossary
from app.parser.pipeline import ParserPipeline
from app.ambiguity.detector import AmbiguityDetector, apply_ambiguity_resolution
from app.verifier.graph_verifier import GraphSoundnessVerifier
from app.verifier.policy_verifier import PolicyAuthorizationVerifier
from app.verifier.smt_verifier import SMTConstraintVerifier
from app.verifier.orchestrator import VerificationOrchestrator
from app.compiler.compiler_service import CompilerService
from app.runtime.simulator import WorkflowSimulator


@pytest.fixture
def org_chart():
    return get_default_org_chart()


@pytest.fixture
def glossary():
    return get_default_glossary()


@pytest.fixture
def benchmark_policy():
    return "For any purchase over $10,000, verify the vendor, check the budget, obtain finance approval, and create the procurement ticket."


def test_parser_pipeline(org_chart, glossary, benchmark_policy):
    pipeline = ParserPipeline(org_chart, glossary)
    graph = pipeline.parse(benchmark_policy)
    
    assert graph is not None
    assert len(graph.nodes) >= 5
    assert len(graph.edges) >= 4
    
    # Check start and end nodes exist
    types = [n.type for n in graph.nodes]
    assert NodeType.START in types
    assert NodeType.END in types
    assert NodeType.DECISION in types


def test_ambiguity_detector_and_resolution(org_chart, glossary, benchmark_policy):
    pipeline = ParserPipeline(org_chart, glossary)
    graph = pipeline.parse(benchmark_policy)
    
    detector = AmbiguityDetector(org_chart)
    findings = detector.detect_ambiguities(graph)
    
    # Benchmark example must trigger missing actor and order ambiguities
    assert len(findings) >= 2
    
    # Find missing actor finding
    missing_actor_f = next((f for f in findings if "Missing Actor" in f.title), None)
    assert missing_actor_f is not None
    assert len(missing_actor_f.candidate_options) > 0
    
    # Apply resolution (e.g. assign to Procurement Officer)
    chosen_opt = missing_actor_f.candidate_options[0]
    updated_graph = apply_ambiguity_resolution(graph, missing_actor_f.id, chosen_opt.id, org_chart)
    
    # Verify node now has assigned actor
    resolved_node = updated_graph.get_node(missing_actor_f.node_id)
    assert resolved_node.actor is not None
    assert resolved_node.actor.role == chosen_opt.payload["role"]


def test_graph_soundness_verifier(org_chart, glossary):
    verifier = GraphSoundnessVerifier()
    
    # Test valid linear graph
    graph = WorkflowGraph(
        id="wf_valid",
        nodes=[
            WorkflowNode(id="n_start", type=NodeType.START, label="Start"),
            WorkflowNode(id="n_task", type=NodeType.TASK, label="Task 1"),
            WorkflowNode(id="n_end", type=NodeType.END, label="End")
        ],
        edges=[
            WorkflowEdge(id="e1", source="n_start", target="n_task"),
            WorkflowEdge(id="e2", source="n_task", target="n_end")
        ]
    )
    
    results = verifier.verify(graph)
    errors = [r for r in results if not r.passed]
    assert len(errors) == 0

    # Test unreachable node (dead code)
    dead_graph = WorkflowGraph(
        id="wf_dead",
        nodes=[
            WorkflowNode(id="n_start", type=NodeType.START, label="Start"),
            WorkflowNode(id="n_task", type=NodeType.TASK, label="Task 1"),
            WorkflowNode(id="n_orphan", type=NodeType.TASK, label="Orphan Task"),
            WorkflowNode(id="n_end", type=NodeType.END, label="End")
        ],
        edges=[
            WorkflowEdge(id="e1", source="n_start", target="n_task"),
            WorkflowEdge(id="e2", source="n_task", target="n_end")
        ]
    )
    results_dead = verifier.verify(dead_graph)
    unreachable_errors = [r for r in results_dead if "Unreachable" in r.title]
    assert len(unreachable_errors) == 1


def test_policy_authorization_verifier(org_chart):
    verifier = PolicyAuthorizationVerifier(org_chart)
    
    # Test exceeding Finance Manager limit ($50k limit vs $100k policy)
    graph = WorkflowGraph(
        id="wf_overflow",
        nodes=[
            WorkflowNode(id="n_start", type=NodeType.START, label="Start"),
            WorkflowNode(
                id="n_appr",
                type=NodeType.APPROVAL,
                label="Finance Signoff",
                actor=Actor(role="Finance Manager", resolved_entity_id="finance_manager"),
                required_authorization="approve_procurement"
            ),
            WorkflowNode(id="n_end", type=NodeType.END, label="End")
        ],
        edges=[
            WorkflowEdge(
                id="e1",
                source="n_start",
                target="n_appr",
                guard=Guard(expression="purchase.amount > 100000", right_operand=100000.0)
            ),
            WorkflowEdge(id="e2", source="n_appr", target="n_end")
        ]
    )
    
    results = verifier.verify(graph)
    limit_errors = [r for r in results if "Limit Exceeded" in r.title]
    assert len(limit_errors) == 1
    assert "Finance Director" in limit_errors[0].suggestion


def test_smt_solver_verifier(glossary):
    verifier = SMTConstraintVerifier()
    
    # Contradictory guards along path: amount > 50000 AND amount < 10000
    contradictory_graph = WorkflowGraph(
        id="wf_smt_dead",
        glossary=glossary,
        nodes=[
            WorkflowNode(id="n_start", type=NodeType.START, label="Start"),
            WorkflowNode(id="n_step1", type=NodeType.TASK, label="Step 1"),
            WorkflowNode(id="n_step2", type=NodeType.TASK, label="Step 2"),
            WorkflowNode(id="n_end", type=NodeType.END, label="End")
        ],
        edges=[
            WorkflowEdge(
                id="e1",
                source="n_start",
                target="n_step1",
                guard=Guard(expression="purchase.amount > 50000", left_operand="purchase.amount", operator=">", right_operand=50000)
            ),
            WorkflowEdge(
                id="e2",
                source="n_step1",
                target="n_step2",
                guard=Guard(expression="purchase.amount < 10000", left_operand="purchase.amount", operator="<", right_operand=10000)
            ),
            WorkflowEdge(id="e3", source="n_step2", target="n_end")
        ]
    )
    
    results = verifier.verify(contradictory_graph)
    unsat_errors = [r for r in results if not r.passed and "Unsatisfiable" in r.title]
    assert len(unsat_errors) == 1


def test_compiler_service(org_chart, glossary, benchmark_policy):
    pipeline = ParserPipeline(org_chart, glossary)
    graph = pipeline.parse(benchmark_policy)
    
    service = CompilerService()
    artifacts = service.compile_all(graph)
    
    assert TargetFormat.BPMN in artifacts
    assert "<?xml" in artifacts[TargetFormat.BPMN].content
    assert "<bpmn:process" in artifacts[TargetFormat.BPMN].content
    assert "<bpmndi:BPMNDiagram" in artifacts[TargetFormat.BPMN].content
    
    assert TargetFormat.TEMPORAL_TS in artifacts
    assert "proxyActivities" in artifacts[TargetFormat.TEMPORAL_TS].content
    
    assert TargetFormat.TEMPORAL_PY in artifacts
    assert "@workflow.defn" in artifacts[TargetFormat.TEMPORAL_PY].content
    
    assert TargetFormat.XSTATE in artifacts
    assert '"states"' in artifacts[TargetFormat.XSTATE].content
    
    assert TargetFormat.MERMAID in artifacts
    assert "flowchart TD" in artifacts[TargetFormat.MERMAID].content


def test_workflow_simulator(org_chart, glossary, benchmark_policy):
    pipeline = ParserPipeline(org_chart, glossary)
    graph = pipeline.parse(benchmark_policy)
    
    simulator = WorkflowSimulator()
    
    # Payload satisfying purchase.amount > 10000
    res = simulator.run_simulation(
        graph=graph,
        initial_payload={"purchase.amount": 15000.0, "vendor.verified": True},
        auto_approve=True
    )
    
    assert res.success is True
    assert res.status == "completed"
    assert len(res.trace) >= 4


def test_rules_manager_and_branch_completeness(benchmark_policy):
    from app.rules.rules_manager import get_rules_manager
    rules_mgr = get_rules_manager()
    rules = rules_mgr.get_rules()
    assert rules is not None
    assert "finance" in rules.role_resolution.role_dictionary
    assert len(rules.authorization.segregation_of_duties) > 0
    assert len(rules.authorization.spend_threshold_tiers) > 0
    
    # Test parser creates branching structure for decision gate
    pipeline = ParserPipeline(get_default_org_chart(), get_default_glossary())
    graph = pipeline.parse(benchmark_policy)
    
    decision_nodes = [n for n in graph.nodes if n.type == NodeType.DECISION]
    assert len(decision_nodes) >= 1
    for dec in decision_nodes:
        outgoing = graph.get_outgoing_edges(dec.id)
        assert len(outgoing) >= 2  # Must fork into at least 2 branches (true vs false/else)

