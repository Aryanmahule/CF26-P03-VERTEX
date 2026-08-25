import os
from typing import Optional
from google import genai
from google.genai import types
from app.ir.models import WorkflowIR


def get_gemini_client(api_key: Optional[str] = None) -> genai.Client:
    """
    Initializes and returns a Google GenAI Client using GEMINI_API_KEY.
    """
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        # In test environments or when client is passed directly, fallback client initialization
        return genai.Client(api_key="mock_key_or_env_missing")
    return genai.Client(api_key=key)


def compile_policy_with_gemini(
    policy_text: str,
    client: Optional[genai.Client] = None
) -> WorkflowIR:
    """
    Parses natural-language policy strings into explicit nodes, actors, actions,
    conditions, and directional edges according to the WorkflowIR schema using
    Google Gemini API with native Structured Outputs.
    """
    if client is None:
        client = get_gemini_client()

    system_instruction = (
        "You are an expert enterprise workflow compiler and formal verification architect.\n"
        "Your task is to parse unstructured or semi-structured natural-language business policies, "
        "Standard Operating Procedures (SOPs), and compliance rules into an explicit, deterministic "
        "Intermediate Representation (IR) graph conforming strictly to the WorkflowIR schema.\n\n"
        "Instructions & Guidelines:\n"
        "1. Nodes:\n"
        "   - Create a single 'start' node (NodeType: 'start') with an ID like 'start_0'.\n"
        "   - Create 'task' nodes (NodeType: 'task') for operational actions (e.g., 'verify vendor', 'check budget').\n"
        "   - Create 'approval' nodes (NodeType: 'approval') for authorization sign-offs (e.g., 'obtain finance approval').\n"
        "   - Create 'decision' nodes (NodeType: 'decision') at branching points where policies differ based on predicates/thresholds (e.g., 'amount > 10000').\n"
        "   - Create 'external_call' nodes (NodeType: 'external_call') for external integrations/tickets (e.g., 'create procurement ticket').\n"
        "   - Create 'end' nodes (NodeType: 'end') terminating each execution path.\n"
        "2. Actors & Permissions:\n"
        "   - For each task and approval node, extract the assigned Actor with role (e.g., 'Finance Manager', 'Requester', 'Security Lead', 'VP Finance').\n"
        "   - If an explicit actor is missing in the text, leave actor as null or assign the contextual role.\n"
        "3. Edges & Conditions:\n"
        "   - Create directional edges connecting nodes from start to end.\n"
        "   - For decision branches, attach Guard objects with normalized boolean expressions (e.g., 'amount > 10000', 'amount <= 10000'), operator, and operands.\n"
        "4. Provenance & Spans:\n"
        "   - Populate source_text and character span offsets (source_span) for each node and edge for explanation traceability."
    )

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        response_schema=WorkflowIR,
        temperature=0.1,
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"Compile the following business policy into a WorkflowIR graph:\n\n{policy_text}",
        config=config,
    )

    # If google-genai returns a parsed Pydantic object
    if hasattr(response, "parsed") and response.parsed is not None and isinstance(response.parsed, WorkflowIR):
        return response.parsed

    # If text is returned as JSON string
    if hasattr(response, "text") and response.text:
        return WorkflowIR.model_validate_json(response.text)

    raise ValueError("Gemini API returned an empty or unparseable response.")
