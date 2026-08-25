# Natural Language → Verified Workflow Compiler

A deterministic multi-stage compiler translating natural language business policies into mathematically verified, authorization-checked executable workflows (**BPMN 2.0 XML**, **Temporal.io TypeScript/Python**, **XState v5 JSON**, **Mermaid**).

---

## 1. System Architecture

```
Natural Language Policy
        │
        ▼
   [FRONTEND]   Parse NL → Intermediate Representation (IR) Graph
        │
        ▼
   [MIDDLE-END] Formal Verification & Proof Engines:
                • Graph Soundness (NetworkX & Petri Net token flow)
                • Authorization & RBAC (IAM roles, limits, separation of duties)
                • Constraint Satisfiability (Z3 SMT Solver for guard logic)
        │
        ▼
   [BACKEND]    Multi-Target Emitter (BPMN 2.0 / Temporal / XState / Mermaid)
        │
        ▼
   [RUNTIME]    Interactive Simulation Engine with Token Stepper & State Trace
```

---

## 2. Key Components

1. **Intermediate Representation (IR)** (`backend/app/ir/`):
   - Typed directed graph (Pydantic v2) with `NodeType`, `Actor`, `Guard`, `WorkflowNode`, `WorkflowEdge`, `WorkflowGraph`.
   - Character offset source spans for explanation traceability.

2. **NL Parser Pipeline** (`backend/app/parser/`):
   - Sentence segmentation, clause decomposition, quantity and quantifier extraction.
   - Deterministic AST extractor with schema-constrained tool structure.

3. **Ambiguity Detector** (`backend/app/ambiguity/`):
   - Missing actor detection on task/approval nodes.
   - Unresolved role and polysemy detection.
   - Sequential vs parallel conjunction ambiguity.
   - Underspecified qualitative predicates.
   - One-click resolution applicator.

4. **Static Verifier** (`backend/app/verifier/`):
   - **Graph Soundness**: NetworkX verification for reachability, deadlocks, sink traps, SCC cycles, and Petri-net balanced split/joins.
   - **Authorization & RBAC**: Enterprise org chart check, IAM permissions, spending limit thresholds, and Separation of Duty (SoD).
   - **Z3 SMT Solver**: Translates guard formulas to Z3 AST; checks path satisfiability (dead path detection), decision exhaustiveness, and disjointness.

5. **Multi-Target Compiler** (`backend/app/compiler/`):
   - **BPMN 2.0 XML**: With full BPMNDiagram layout coordinates.
   - **Temporal.io TypeScript**: With proxyActivities, signals, and approval wait conditions.
   - **Temporal.io Python**: With `@workflow.defn`, dataclasses, and queries.
   - **XState v5 JSON**: State machine configuration with guards and transitions.
   - **Mermaid**: Visual flowchart syntax.

6. **Interactive Studio & Simulator** (`frontend/`):
   - React + Vite + TypeScript + TailwindCSS + `@xyflow/react`.
   - Monaco/Rich text policy editor with clickable source span highlighting.
   - Live Token Stepper and dynamic variable payload evaluator.
   - Enterprise IAM Org Chart and Business Glossary explorer.

---

## 3. Quickstart

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000 --reload
```

Run test suite:
```bash
cd backend
python -m pytest tests -v
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.
