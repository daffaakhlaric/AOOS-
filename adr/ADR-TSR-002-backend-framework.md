# ADR-TSR-002 — Backend Framework

**Status:** Accepted

**Context:** TypeScript services (API Gateway integration, Core Runtime containers, Registry Service, and others per §3.1) require a hosting framework with first-class Dependency Injection (Constitution §3.13), modular structure compatible with Plugin-First and Hexagonal Architecture (Constitution §3.11, ADR-005/ADR-006 in doc 002), and native or near-native OpenAPI generation for Contract-derived API surfaces (doc 003.5 §1.4). Candidates evaluated: NestJS, Fastify, Express, FastAPI (Python-scoped), Go Fiber (Go-scoped) — full evaluation in [`tech-stack/backend-framework.md`](../tech-stack/backend-framework.md) and [`decision-matrix/backend-framework.md`](../decision-matrix/backend-framework.md).

**Decision:** NestJS is the backend framework for all TypeScript services. Fastify is used as NestJS's underlying HTTP adapter for latency-sensitive modules (NestJS natively supports both Express and Fastify adapters). FastAPI is used only within the Python-scoped services already carved out in ADR-TSR-001. Go Fiber is used only within the Go-scoped services already carved out in ADR-TSR-001.

**Consequences:** Every TypeScript service adopts NestJS's module/provider/controller structure, giving the platform a consistent, enforced architectural pattern rather than relying on per-team convention, at the cost of a steeper onboarding curve than bare Express/Fastify. Latency-sensitive modules can opt into the Fastify adapter without leaving NestJS's structural benefits, avoiding a hard performance/structure trade-off. OpenAPI documentation is largely generated from the same decorators that define routes, reducing double-maintenance of API surfaces.

**Alternatives Considered:**

- **Bare Fastify, no NestJS layer** — rejected as the default: better raw performance but no enforced DI/module structure, leaving Hexagonal/Plugin-First discipline to developer convention rather than framework enforcement. Retained as the underlying adapter for specific modules that need it.
- **Bare Express** — rejected: superseded by Fastify's performance and NestJS's structure; not recommended as a standalone choice.
- **FastAPI as the primary backend framework** — rejected: excellent for its own ecosystem but Python is scoped to AI/data tooling only (ADR-TSR-001), not the general backend.
- **Go Fiber as the primary backend framework** — rejected: Go is scoped to a narrow set of performance-critical services only (ADR-TSR-001), not the general backend.
