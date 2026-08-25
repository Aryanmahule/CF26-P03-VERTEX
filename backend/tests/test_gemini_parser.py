import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.ir.models import (
    WorkflowIR, WorkflowNode, WorkflowEdge, NodeType, Actor, Guard, TargetFormat
)
from app.parser.gemini_parser import compile_policy_with_gemini, get_gemini_client
from app.verifier.orchestrator import WorkflowVerifier
from src.main import app


def get_mock_workflow_ir() -> WorkflowIR:
    """Helper creating a valid canonical WorkflowIR graph."""
    nodes = [
        WorkflowNode(
            id="start_0",
            type=NodeType.START,
            label="Start Procurement Process",
            source_span=(0, 20),
            source_text="For any purchase"
        ),
        WorkflowNode(
            id="decision_1",
            type=NodeType.DECISION,
            label="Check Amount Threshold ($10k)",
            source_span=(21, 40),
            source_text="over $10,000"
        ),
        WorkflowNode(
            id="task_vendor",
            type=NodeType.TASK,
            label="Verify Vendor",
            actor=Actor(role="Procurement Officer", department="Procurement"),
            source_span=(41, 55),
            source_text="verify the vendor"
        ),
        WorkflowNode(
            id="approval_finance",
            type=NodeType.APPROVAL,
            label="Finance Manager Approval",
            actor=Actor(role="Finance Manager", department="Finance"),
            required_authorization="approve_procurement",
            source_span=(56, 85),
            source_text="obtain finance approval"
        ),
        WorkflowNode(
            id="external_ticket",
            type=NodeType.EXTERNAL_CALL,
            label="Create Procurement Ticket in ERP",
            actor=Actor(role="System Administrator", department="IT"),
            source_span=(86, 120),
            source_text="create the procurement ticket"
        ),
        WorkflowNode(
            id="end_0",
            type=NodeType.END,
            label="End Workflow",
            source_span=(121, 130),
            source_text="ticket created"
        )
    ]
    edges = [
        WorkflowEdge(
            id="e_start_dec",
            source="start_0",
            target="decision_1"
        ),
        WorkflowEdge(
            id="e_dec_vendor",
            source="decision_1",
            target="task_vendor",
            label="amount > 10000",
            guard=Guard(
                expression="amount > 10000",
                operator=">",
                left_operand="amount",
                right_operand=10000,
                variables=["amount"],
                source_text="over $10,000"
            )
        ),
        WorkflowEdge(
            id="e_vendor_appr",
            source="task_vendor",
            target="approval_finance"
        ),
        WorkflowEdge(
            id="e_appr_ticket",
            source="approval_finance",
            target="external_ticket"
        ),
        WorkflowEdge(
            id="e_ticket_end",
            source="external_ticket",
            target="end_0"
        ),
        WorkflowEdge(
            id="e_dec_end_low",
            source="decision_1",
            target="end_0",
            label="amount <= 10000",
            guard=Guard(
                expression="amount <= 10000",
                operator="<=",
                left_operand="amount",
                right_operand=10000,
                variables=["amount"],
                source_text="otherwise"
            )
        )
    ]
    return WorkflowIR(
        id="wf_procurement_mock",
        name="Procurement Workflow",
        policy_text="For any purchase over $10,000, verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.",
        nodes=nodes,
        edges=edges
    )


def test_compile_policy_with_gemini_structured_parsed():
    """Verify compile_policy_with_gemini extracts WorkflowIR from response.parsed."""
    mock_workflow = get_mock_workflow_ir()
    
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = mock_workflow
    mock_response.text = None
    mock_client.models.generate_content.return_value = mock_response

    policy_text = "For any purchase over $10,000, verify the vendor, check the budget, obtain finance approval, and create the procurement ticket."
    result = compile_policy_with_gemini(policy_text, client=mock_client)

    assert isinstance(result, WorkflowIR)
    assert len(result.nodes) == 6
    assert len(result.edges) == 6
    assert any(n.type == NodeType.APPROVAL for n in result.nodes)
    assert any(n.type == NodeType.DECISION for n in result.nodes)
    
    # Assert generate_content was invoked with correct model and schema config
    mock_client.models.generate_content.assert_called_once()
    call_kwargs = mock_client.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-2.5-flash"
    assert call_kwargs["config"].response_schema == WorkflowIR
    assert call_kwargs["config"].response_mime_type == "application/json"


def test_compile_policy_with_gemini_json_text_fallback():
    """Verify fallback when response provides JSON string via response.text."""
    mock_workflow = get_mock_workflow_ir()
    json_text = mock_workflow.model_dump_json()

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = None
    mock_response.text = json_text
    mock_client.models.generate_content.return_value = mock_response

    result = compile_policy_with_gemini("Sample policy", client=mock_client)

    assert isinstance(result, WorkflowIR)
    assert result.id == "wf_procurement_mock"
    assert len(result.nodes) == 6


def test_workflow_verifier_on_gemini_output():
    """Verify that WorkflowVerifier runs soundness, authorization, and SMT checks on Gemini output."""
    mock_workflow = get_mock_workflow_ir()
    verifier = WorkflowVerifier()
    
    report = verifier.verify(mock_workflow)
    assert report is not None
    assert report.is_valid is True
    assert report.soundness_passed is True
    assert report.authorization_passed is True
    assert report.smt_passed is True
    assert len(report.checks) > 0


def test_api_compile_endpoint_with_mocked_gemini():
    """Test POST /compile endpoint accepting policy_text and returning verified compiled workflow."""
    mock_workflow = get_mock_workflow_ir()
    
    with patch("src.main.compile_policy_with_gemini", return_value=mock_workflow):
        client = TestClient(app)
        response = client.post("/compile", json={
            "policy_text": "For any purchase over $10,000, verify the vendor, obtain finance approval, and create the procurement ticket."
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "graph" in data
        assert "report" in data
        assert "artifacts" in data
        assert data["report"]["is_valid"] is True
        assert "bpmn" in data["artifacts"]
        assert "temporal_ts" in data["artifacts"]
        assert "xstate" in data["artifacts"]
