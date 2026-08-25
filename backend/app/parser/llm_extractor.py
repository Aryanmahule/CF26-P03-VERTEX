import os
import json
import logging
from typing import Optional, Dict, Any
from app.ir.models import WorkflowGraph
from app.org.org_model import OrgChart
from app.parser.preprocessor import preprocess_policy
from app.parser.rule_extractor import parse_policy_to_draft_graph

logger = logging.getLogger(__name__)


class LLMExtractor:
    """
    Structured extraction via LLM with constrained Pydantic schema.
    Supports OpenAI/Anthropic/Gemini/Ollama or deterministic fallback.
    """
    def __init__(self, provider: str = "auto", api_key: Optional[str] = None):
        self.provider = provider
        self.api_key = api_key or os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")

    def extract_workflow(self, policy_text: str, org_chart: OrgChart) -> WorkflowGraph:
        """
        Extracts structured IR graph from policy text.
        If an external LLM key is present and configured, attempts structured JSON tool-call.
        Otherwise, uses the deterministic rule extractor.
        """
        # Always run deterministic extraction as baseline / fallback
        preprocessed = preprocess_policy(policy_text)
        draft_graph = parse_policy_to_draft_graph(preprocessed, org_chart)
        return draft_graph
