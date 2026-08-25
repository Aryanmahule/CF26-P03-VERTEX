from typing import Optional, Dict
from app.ir.models import WorkflowGraph, GlossaryItem
from app.org.org_model import OrgChart, get_default_org_chart, get_default_glossary
from app.parser.preprocessor import preprocess_policy
from app.parser.rule_extractor import parse_policy_to_draft_graph
from app.parser.llm_extractor import LLMExtractor


class ParserPipeline:
    def __init__(self, org_chart: Optional[OrgChart] = None, glossary: Optional[Dict[str, GlossaryItem]] = None):
        self.org_chart = org_chart or get_default_org_chart()
        self.glossary = glossary or get_default_glossary()
        self.llm_extractor = LLMExtractor()

    def parse(self, policy_text: str) -> WorkflowGraph:
        """
        Parses natural language policy into a draft typed WorkflowGraph IR.
        """
        preprocessed = preprocess_policy(policy_text)
        graph = self.llm_extractor.extract_workflow(policy_text, self.org_chart)
        
        # Attach glossary and metadata
        graph.glossary = self.glossary
        graph.metadata = {
            "sentence_count": len(preprocessed.sentences),
            "clause_count": len(preprocessed.clauses),
            "extracted_entities": preprocessed.extracted_entities,
            "detected_connectives": preprocessed.detected_connectives
        }
        return graph
