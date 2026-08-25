import re
from typing import List, Tuple, Dict, Any
from pydantic import BaseModel


class TextSpan(BaseModel):
    text: str
    start: int
    end: int


class PreprocessedPolicy(BaseModel):
    raw_text: str
    sentences: List[TextSpan]
    clauses: List[TextSpan]
    extracted_entities: List[Dict[str, Any]]
    detected_connectives: List[Dict[str, Any]]


def segment_sentences(text: str) -> List[TextSpan]:
    """Segments text into sentences while retaining exact char offsets."""
    sentences = []
    # Match sentences ending with . ! ? or newlines
    pattern = re.compile(r'[^.!?\n]+[.!?\n]?')
    for match in pattern.finditer(text):
        chunk = match.group().strip()
        if chunk:
            start = match.start()
            # find real start after strip
            real_start = text.find(chunk, start)
            real_end = real_start + len(chunk)
            sentences.append(TextSpan(text=chunk, start=real_start, end=real_end))
    if not sentences and text.strip():
        sentences.append(TextSpan(text=text.strip(), start=0, end=len(text)))
    return sentences


def segment_clauses(text: str) -> List[TextSpan]:
    """Segments a sentence into sub-clauses based on punctuation and coordinating conjunctions."""
    clauses = []
    # Split by semicolons, 'and then', 'then', or commas followed by space and a word/letter
    delimiters = re.compile(r'(?:,\s+(?=[a-zA-Z])|\band\s+then\b|\bthen\b|;\s*)', re.IGNORECASE)
    
    last_idx = 0
    for match in delimiters.finditer(text):
        part = text[last_idx:match.start()].strip()
        if part:
            start_pos = text.find(part, last_idx)
            clauses.append(TextSpan(text=part, start=start_pos, end=start_pos + len(part)))
        last_idx = match.end()
        
    tail = text[last_idx:].strip()
    if tail:
        start_pos = text.find(tail, last_idx)
        clauses.append(TextSpan(text=tail, start=start_pos, end=start_pos + len(tail)))
        
    return clauses if clauses else [TextSpan(text=text.strip(), start=0, end=len(text))]


def extract_quantities_and_amounts(text: str) -> List[Dict[str, Any]]:
    """Extracts monetary amounts, numeric thresholds, percentages, and operators."""
    findings = []
    # Match $10,000, $10000, 10,000 USD, 50k, 100K, > 10000, over $10,000
    currency_regex = re.compile(
        r'(?:(over|greater than|more than|above|exceeds?|at least|under|less than|below|up to|equal to|<=|>=|<|>|=)\s*)?'
        r'(\$?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|million|thousand|usd|dollars)?)',
        re.IGNORECASE
    )
    
    for match in currency_regex.finditer(text):
        op_text = match.group(1) or ""
        val_text = match.group(2).strip()
        
        # normalize value
        numeric_val = None
        clean_num = val_text.replace('$', '').replace(',', '').strip().lower()
        multiplier = 1.0
        if clean_num.endswith('k') or clean_num.endswith('thousand'):
            multiplier = 1000.0
            clean_num = clean_num.replace('k', '').replace('thousand', '').strip()
        elif clean_num.endswith('m') or clean_num.endswith('million'):
            multiplier = 1000000.0
            clean_num = clean_num.replace('m', '').replace('million', '').strip()
        elif 'usd' in clean_num or 'dollars' in clean_num:
            clean_num = clean_num.replace('usd', '').replace('dollars', '').strip()
            
        try:
            numeric_val = float(clean_num) * multiplier
        except ValueError:
            continue
            
        op_map = {
            "over": ">",
            "greater than": ">",
            "more than": ">",
            "above": ">",
            "exceeds": ">",
            "exceed": ">",
            "at least": ">=",
            "under": "<",
            "less than": "<",
            "below": "<",
            "up to": "<=",
            "equal to": "==",
            ">": ">",
            "<": "<",
            ">=": ">=",
            "<=": "<=",
            "=": "=="
        }
        
        norm_op = op_map.get(op_text.lower().strip(), ">" if "over" in op_text.lower() else "==")
        
        findings.append({
            "span": (match.start(), match.end()),
            "raw": match.group(0),
            "operator": norm_op,
            "value": numeric_val,
            "raw_value": val_text
        })
    return findings


def preprocess_policy(text: str) -> PreprocessedPolicy:
    sentences = segment_sentences(text)
    clauses = []
    for s in sentences:
        sub_clauses = segment_clauses(s.text)
        for sc in sub_clauses:
            clauses.append(TextSpan(text=sc.text, start=s.start + sc.start, end=s.start + sc.end))
            
    entities = extract_quantities_and_amounts(text)
    
    # Detect connectives
    connectives = []
    conn_pattern = re.compile(
        r'\b(if|when|for any|for every|unless|otherwise|in parallel|simultaneously|concurrently|then|after|before|first|finally|and then)\b',
        re.IGNORECASE
    )
    for match in conn_pattern.finditer(text):
        connectives.append({
            "word": match.group(0).lower(),
            "span": (match.start(), match.end())
        })
        
    return PreprocessedPolicy(
        raw_text=text,
        sentences=sentences,
        clauses=clauses,
        extracted_entities=entities,
        detected_connectives=connectives
    )
