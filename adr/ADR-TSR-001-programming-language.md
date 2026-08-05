# ADR-TSR-001 — Programming Language

**Status:** Accepted

**Context:** The Core Runtime, Agent Runtime, Workflow Runtime, Tool Manager, API Gateway, SDK, and Dashboard all require a language decision before any other implementation work can begin. The platform requires async-first execution (Constitution §3.7), strong typing suited to Contract-schema-derived codegen (doc 003.5 §1.4), a mature ecosystem spanning both web/API backend and AI/LLM tooling, and a hiring-viable talent pool. Candidates evaluated: TypeScript, Go, Rust, Python — full evaluation in [`tech-stack/programming-language.md`](../tech-stack/programming-language.md) and [`decision-matrix/programming-language.md`](../decision-matrix/programming-language.md).

**Decision:** TypeScript is the primary language for the majority of the platform (Core Runtime, Agent Runtime, Workflow Runtime, Tool Manager, API Gateway, SDK, Dashboard). Go is adopted for a narrow, explicitly scoped set of performance-critical services: the Event Bus consumer fan-out layer and the API Gateway's hot edge path. Python is adopted for AI/data tooling only: embedding pipeline scripts, Simulation Contract scenario generation, and Knowledge ingestion tooling. Rust is not adopted for v1.

**Consequences:** The platform runs a three-language footprint (TypeScript/Go/Python) rather than a single-language monorepo, requiring shared CI/CD tooling (GitHub Actions, §3.18) to standardize build/test patterns across all three and increasing cross-team coordination overhead (tracked as RISK-012 in the risk register). In exchange, the majority of the platform stays in one language (lowest cognitive/hiring overhead), and each additional language solves a specific, named problem TypeScript solves worse rather than being adopted by developer preference.

**Alternatives Considered:**

- **All-TypeScript, no carve-outs** — rejected: leaves the Event Bus fan-out layer and API Gateway hot edge without a clean answer to their latency/memory requirements at high fan-out, and forgoes Python's dominant AI/ML tooling ecosystem for embedding/data work.
- **Go as the primary backend language** — rejected: weaker fit for Contract-schema-driven codegen and a smaller ecosystem for AI/LLM tooling and general web/API work than TypeScript.
- **Rust adopted for v1** — rejected: real safety/performance ceiling, but hiring/velocity cost not justified until a specific, measured hot path demands it; retained as a Future Consideration, not a permanent rejection.
- **Python as the primary backend language** — rejected: weaker fit for high-concurrency async web backend work at AOS's scale relative to TypeScript/Node, despite Python's AI/ML ecosystem strength (which is why it is scoped to AI/data tooling instead).
