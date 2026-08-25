from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router

app = FastAPI(
    title="Natural Language → Verified Workflow Compiler API",
    description="Deterministic multi-stage compiler translating natural language business policies into mathematically verified executable workflows.",
    version="1.0.0"
)

# Configure CORS for frontend SPA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")


@app.post("/compile")
def compile_direct(req: dict):
    from app.api.routes import compile_workflow, CompileRequest
    compile_req = CompileRequest(**req)
    return compile_workflow(compile_req)


@app.get("/")
def root():
    return {
        "status": "online",
        "name": "Natural Language → Verified Workflow Compiler",
        "version": "1.0.0",
        "endpoints": {
            "presets": "/api/presets",
            "parse": "/api/parse",
            "verify": "/api/verify",
            "resolve_ambiguity": "/api/ambiguity/resolve",
            "compile": "/api/compile",
            "simulate": "/api/simulate",
            "org": "/api/org"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

