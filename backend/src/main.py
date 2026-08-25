from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any

from app.ir.models import WorkflowIR, WorkflowGraph, TargetFormat
from app.verifier.orchestrator import WorkflowVerifier, VerificationOrchestrator
from app.parser.gemini_parser import compile_policy_with_gemini
from app.compiler.compiler_service import CompilerService
from app.api.routes import router as api_router

app = FastAPI(
    title="Natural Language → Verified Workflow Compiler API",
    description="Deterministic multi-stage compiler translating natural language business policies into mathematically verified executable workflows.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")

verifier = WorkflowVerifier()
compiler = CompilerService()


@app.post("/compile")
def compile_endpoint(payload: Dict[str, Any]):
    """
    Accepts `{ "policy_text": "..." }` or `{ "graph": {...}, "target_format": "..." }`,
    parses policy with Gemini Structured Outputs if policy_text is provided,
    runs the resulting graph through WorkflowVerifier, and returns the compiled result.
    """
    policy_text = payload.get("policy_text")
    graph_dict = payload.get("graph")
    target_format = payload.get("target_format")

    if policy_text:
        graph = compile_policy_with_gemini(policy_text)
    elif graph_dict:
        graph = WorkflowGraph.model_validate(graph_dict)
    else:
        raise HTTPException(status_code=400, detail="Either 'policy_text' or 'graph' must be provided.")

    # Run through WorkflowVerifier
    report = verifier.verify(graph)

    # Compile artifacts
    if target_format:
        tf = TargetFormat(target_format)
        artifact = compiler.compile(graph, tf)
        return {
            "graph": graph,
            "report": report,
            "artifacts": {tf.value: artifact}
        }
    else:
        artifacts = compiler.compile_all(graph)
        return {
            "graph": graph,
            "report": report,
            "artifacts": {k.value: v for k, v in artifacts.items()}
        }


@app.get("/")
def root():
    return {
        "status": "online",
        "name": "Natural Language → Verified Workflow Compiler",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8081, reload=True)
