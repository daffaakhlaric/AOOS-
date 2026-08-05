# 004 — AOS Enterprise Technology Selection Record (TSR)

**Status:** ACTIVE — Final technology reference for all implementation
**Governs under:** [`001-ENGINEERING-CONSTITUTION.md`](./001-ENGINEERING-CONSTITUTION.md), [`002-ENTERPRISE-ARCHITECTURE.md`](./002-ENTERPRISE-ARCHITECTURE.md), [`003-DOMAIN-DRIVEN-DESIGN.md`](./003-DOMAIN-DRIVEN-DESIGN.md), [`003.5-CONTRACT-FIRST-DESIGN.md`](./003.5-CONTRACT-FIRST-DESIGN.md)
**Scope:** Technology decisions only. No runtime, no API, no database schema, no agent, no workflow, no dashboard, no code.

---

## 0. Conformance Check

All four prior documents were read in full before drafting this TSR. No conflicts were found — every decision below is a concretization of a category already named in Architecture doc 002 §38 (Tech Stack Recommendation), constrained by Constitution doc 001 principles (Cloud Native §3.15, Multi-Tenant §3.14, Cost Optimization §33, Security §20), and shaped by the Contract Specification's schema/registry model (doc 003.5). Where doc 002 §38 left a category open ("deferred to an infrastructure-selection ADR"), this document is that ADR set. No RULE is violated; no prior document is amended. New ADRs (ADR-TSR-001 through ADR-TSR-025, one per category) are recorded per category in `adr/`.

---

## 1. Executive Summary

This TSR makes 25 binding technology decisions plus an AI Model Routing Strategy and a three-tier Cost Analysis (100 / 1,000 / 10,000 dealers). The guiding selection philosophy, applied consistently across every category:

1. **Multi-tenant cost efficiency wins over raw peak performance** — AOS's differentiator is autonomous operation across thousands of tenants, not any single tenant's throughput ceiling (Constitution §33).
2. **Open, self-hostable, non-restrictively-licensed technology is preferred over proprietary/SaaS-locked options** wherever the operational burden is acceptable, to avoid per-tenant/per-seat vendor pricing that scales worse than our own cost model (Constitution RULE on vendor lock-in, Architecture §29 ACL pattern).
3. **Contract-First compatibility is a hard filter** — a candidate that cannot cleanly sit behind our own Contracts (doc 003.5) without becoming a leaky abstraction is disqualified, regardless of popularity.
4. **TypeScript-first, polyglot-by-exception** — the platform is TypeScript/Node.js by default; Go and Python are used only where they solve a specific, named problem TypeScript solves worse.

**One-line decision summary per category** (full rationale in §3):

| #   | Category             | Final Recommendation                                                           |
| --- | -------------------- | ------------------------------------------------------------------------------ |
| 1   | Programming Language | TypeScript (primary) + Go (perf-critical services) + Python (AI/data tooling)  |
| 2   | Backend Framework    | NestJS                                                                         |
| 3   | Frontend             | Next.js                                                                        |
| 4   | Database             | PostgreSQL (default) + CockroachDB (Enterprise/multi-region escape hatch)      |
| 5   | ORM                  | Drizzle                                                                        |
| 6   | Cache                | Valkey (DragonflyDB as future upgrade path)                                    |
| 7   | Queue                | BullMQ (job queue) + NATS JetStream (event streaming/delayed jobs)             |
| 8   | Event Bus            | NATS JetStream (Kafka as scale-up migration path)                              |
| 9   | Workflow Engine      | Temporal                                                                       |
| 10  | AI Gateway           | LiteLLM (self-hosted)                                                          |
| 11  | LLM Orchestration    | Custom Runtime (against Planner/Reasoner/Reflection Contracts)                 |
| 12  | Vector Database      | pgvector (default) + Qdrant (Enterprise/scale escape hatch)                    |
| 13  | Object Storage       | Cloudflare R2 (default) + S3 (cloud-native fallback) + MinIO (self-hosted/dev) |
| 14  | Search Engine        | Meilisearch (OpenSearch as future upgrade path)                                |
| 15  | API Gateway          | Kong                                                                           |
| 16  | Authentication       | Keycloak                                                                       |
| 17  | Observability        | OpenTelemetry + Grafana + Prometheus + Loki + Tempo ("LGTM stack")             |
| 18  | CI/CD                | GitHub Actions + ArgoCD                                                        |
| 19  | Container            | Docker                                                                         |
| 20  | Orchestration        | Kubernetes                                                                     |
| 21  | IaC                  | Terraform                                                                      |
| 22  | Secret Management    | HashiCorp Vault                                                                |
| 23  | Monitoring           | Grafana Stack (self-hosted/Grafana Cloud)                                      |
| 24  | Testing              | Vitest + Playwright                                                            |
| 25  | Documentation        | Docusaurus (internal handbook) + Mintlify (external API/SDK docs)              |

Full per-category detail (Objective, Requirements, Candidates, Evaluation Matrix, Benchmark, Performance/Scalability/Reliability/Security/Maintainability/DX/Ecosystem/Community/Licensing/Cloud Compatibility/Vendor Lock-in/Cost/Pros/Cons/Trade-offs/Migration/Future Consideration) lives in `tech-stack/<category>.md`, with the scoring matrix mirrored in `decision-matrix/<category>.md` and the formal decision record in `adr/ADR-TSR-0NN-<category>.md`.

---

## 2. Evaluation Methodology

Every category was scored qualitatively (High / Medium / Low, or a 1–5 scale in the detailed `decision-matrix/` files) across the fixed dimension set required by the task brief: Performance, Scalability, Reliability, Security, Maintainability, Developer Experience, Ecosystem, Community Maturity, Licensing, Cloud Compatibility, Vendor Lock-in, Estimated Cost. Benchmarks cite official documentation and widely-reported industry practice (no proprietary AOS benchmarking has been run yet — this is a pre-implementation decision record, not a performance report). Where a benchmark claim is directional rather than a precise number, it is stated as such rather than fabricated with false precision.

---

## 3. Technology Decisions

### 3.1 Programming Language

**Objective:** Choose the language(s) the platform's Core Runtime, SDK, and services are built in.
**Requirements:** Must support async-first execution (Constitution §3.7), strong typing for Contract-schema-derived types (doc 003.5 §1.4 codegen goal), a mature ecosystem for both web backend and AI/LLM tooling, and a hiring-viable talent pool at SaaS-startup-to-scaleup velocity.
**Candidates:** TypeScript, Go, Rust, Python.
**Evaluation Summary:**

| Dimension                            | TypeScript                                | Go                 | Rust             | Python                        |
| ------------------------------------ | ----------------------------------------- | ------------------ | ---------------- | ----------------------------- |
| Performance                          | Medium                                    | High               | Very High        | Low–Medium                    |
| Concurrency model fit (async-first)  | High (native async/await, huge ecosystem) | High (goroutines)  | High (but steep) | Medium (asyncio, GIL caveats) |
| Type-system fit for Contract codegen | High                                      | Medium             | High             | Medium (typing improving)     |
| Ecosystem for web/API                | Very High                                 | High               | Medium           | High                          |
| Ecosystem for AI/LLM tooling         | High (growing fast)                       | Low–Medium         | Low              | Very High (dominant)          |
| Hiring pool / ramp-up speed          | Very High                                 | High               | Low–Medium       | Very High                     |
| Memory safety without GC pauses      | No (GC)                                   | No (GC, low-pause) | Yes              | No (GC)                       |

**Final Recommendation:** **TypeScript as the primary language** for Core Runtime, Agent Runtime, Workflow Runtime, Tool Manager, API Gateway, SDK, and Dashboard — it is the one language that serves both "enterprise backend" and "Contract-schema-driven codegen target" well, and keeps a single-language monorepo for the majority of the platform (lowest cognitive/hiring overhead, Constitution §2 simplicity bias). **Go for a small set of explicitly performance-critical services** where TypeScript's single-threaded event loop becomes the bottleneck: the Event Bus consumer fan-out layer and the API Gateway's hot edge path, both of which benefit from Go's lower-latency concurrency and lower per-request memory footprint at very high request volume. **Python for AI/data tooling only** — embedding pipeline scripts, Simulation Contract scenario generation, and any data-science-style Knowledge ingestion work, where Python's AI/ML ecosystem dominance (Constitution §23 AI Model Standards) is decisive. **Rust is not adopted for v1** — its safety/performance ceiling is real but the hiring and velocity cost is not justified until a specific, measured hot path demands it; this is explicitly flagged as a Future Consideration (§3.1 in `tech-stack/programming-language.md`), not a rejection.
**Trade-off:** A three-language footprint (TS/Go/Python) costs more cross-team coordination than a single-language shop, but each addition is scoped to a narrow, justified purpose rather than "use whatever a given engineer prefers" — consistent with Constitution §2 (no unjustified abstraction/tooling sprawl).
**ADR Reference:** [`adr/ADR-TSR-001-programming-language.md`](../adr/ADR-TSR-001-programming-language.md)

### 3.2 Backend Framework

**Objective:** Choose the framework hosting the TypeScript services (API Gateway, Core Runtime containers, Registry Service).
**Requirements:** First-class Dependency Injection (Constitution §3.13), modular structure compatible with Plugin-First (§3.1) and Hexagonal Architecture (§3.11), native OpenAPI generation for Contract-derived API surfaces (doc 003.5 §1.4).
**Candidates:** NestJS, Fastify, Express, FastAPI, Go Fiber.
**Final Recommendation:** **NestJS** — its module/provider/DI system is structurally the closest match to Hexagonal Architecture and Plugin-First out of the box, decorator-based OpenAPI generation aligns with Contract-First codegen goals, and it sits on top of Express/Fastify adapters so raw performance is still available where needed. **Fastify** is retained as the underlying HTTP adapter for latency-sensitive NestJS modules (NestJS supports both). **Express** is not recommended as a standalone choice (superseded by Fastify's performance and NestJS's structure). **FastAPI** is used only within the Python-scoped services from §3.1 (AI/data tooling), not the primary backend. **Go Fiber** is used only within the Go-scoped services from §3.1.
**Trade-off:** NestJS's opinionated structure has a steeper initial learning curve than bare Express/Fastify, accepted because it enforces the architectural discipline the Constitution already mandates rather than relying on developer convention.
**ADR Reference:** [`adr/ADR-TSR-002-backend-framework.md`](../adr/ADR-TSR-002-backend-framework.md)

### 3.3 Frontend

**Objective:** Choose the framework for the Dealer Admin Dashboard and Sales Console.
**Requirements:** Server-side rendering for dashboard performance at scale, strong component ecosystem, large hiring pool, good support for real-time data (Hot Lead notifications, live campaign metrics).
**Candidates:** Next.js, React (bare), Vue, SvelteKit.
**Final Recommendation:** **Next.js** — React's ecosystem dominance plus built-in SSR/ISR/routing removes the need to hand-assemble a React toolchain (bare React is not a complete answer on its own), and its hiring pool and component-library ecosystem (matching Architecture §38's `ui-components` package) is the largest of the four. **Vue and SvelteKit** are technically credible (SvelteKit in particular has strong performance characteristics) but lose on ecosystem depth and hiring availability for an enterprise SaaS dashboard with many future feature surfaces (Sales Console, multi-branch reporting, Agent/Workflow admin UI).
**Trade-off:** Next.js's opinionated file-based routing and server/client component split add a learning curve versus bare React, accepted for the SSR performance and ecosystem payoff.
**ADR Reference:** [`adr/ADR-TSR-003-frontend.md`](../adr/ADR-TSR-003-frontend.md)

### 3.4 Database

**Objective:** Choose the primary OLTP data store satisfying DDD §25 Tenant Isolation (RLS default, DB-per-tenant escape hatch).
**Requirements:** Native Row-Level Security, mature partitioning, strong HA/replication, pgvector compatibility (§3.12), large operational talent pool.
**Candidates:** PostgreSQL, MySQL, CockroachDB, YugabyteDB.
**Evaluation Summary:**

| Dimension                        | PostgreSQL                  | MySQL               | CockroachDB                                   | YugabyteDB                               |
| -------------------------------- | --------------------------- | ------------------- | --------------------------------------------- | ---------------------------------------- |
| Native RLS                       | Yes (mature)                | No (app-layer only) | Yes (Postgres-compatible)                     | Yes (Postgres-compatible)                |
| Partitioning                     | Mature (declarative)        | Adequate            | Automatic (range/hash sharding)               | Automatic (tablet sharding)              |
| HA / Replication                 | Mature (streaming, logical) | Mature              | Native multi-region, strongly consistent      | Native multi-region, strongly consistent |
| pgvector support                 | Native extension            | No                  | Not compatible (own vector type, less mature) | Not compatible                           |
| Operational maturity/talent pool | Very High                   | Very High           | Medium                                        | Low–Medium                               |

**Final Recommendation:** **PostgreSQL** (managed — RDS/Cloud SQL/Neon-class provider) as the default for the shared RLS tier and schema-per-tenant tier (DDD §25). **CockroachDB** recommended as the **Enterprise/Tier-1 escape hatch** for tenants requiring automatic multi-region strong consistency and horizontal write-scaling beyond what a single Postgres primary comfortably handles — chosen over YugabyteDB primarily for its more mature managed-service availability and broader operational track record at the time of this writing. **MySQL is not recommended** — its RLS story is application-layer only (violates DDD §25's storage-layer-enforcement principle) and it lacks pgvector, forcing a second database for Memory/Knowledge (§3.12) that Postgres avoids by itself.
**Trade-off:** Running two database technologies (Postgres default + CockroachDB for Enterprise tier) is more operational surface than one, but is the direct, intentional realization of Architecture §12's stated database-per-tenant escape hatch for demanding tenants — the alternative (forcing every tenant onto Postgres regardless of region/scale needs) would violate that already-established architecture.
**ADR Reference:** [`adr/ADR-TSR-004-database.md`](../adr/ADR-TSR-004-database.md)

### 3.5 ORM

**Objective:** Choose the TypeScript data-access layer for PostgreSQL/CockroachDB.
**Requirements:** Must not fight RLS (session-variable-scoped tenant context per query), acceptable performance overhead, strong TypeScript type inference for Contract-schema alignment.
**Candidates:** Prisma, Drizzle, TypeORM.
**Final Recommendation:** **Drizzle** — its SQL-first design and lack of a query-engine binary/connection-pooling layer of its own makes per-request RLS session variable scoping (`SET LOCAL app.tenant_id`) straightforward to guarantee correctly, whereas Prisma's connection pooling and prepared-statement caching have documented friction with per-request RLS context switching. Drizzle's lighter runtime footprint also fits the many-small-services Core Runtime model better than Prisma's heavier client generation step. **TypeORM is not recommended** — comparatively slower community/maintenance velocity and heavier decorator/ActiveRecord-style patterns that fit poorly with the Hexagonal Architecture's persistence-as-adapter model.
**Trade-off:** Drizzle's ecosystem and tooling (migrations, admin UI) is less mature than Prisma's, accepted because correctness of tenant isolation (Constitution RULE-016) outweighs developer-tooling polish.
**ADR Reference:** [`adr/ADR-TSR-005-orm.md`](../adr/ADR-TSR-005-orm.md)

### 3.6 Cache

**Objective:** Choose the in-memory store for Working Memory (Memory Contract), rate-limit counters, and session data.
**Requirements:** Sub-millisecond latency, Redis-protocol compatibility (broad client/library support), acceptable licensing for a commercial SaaS.
**Candidates:** Redis, DragonflyDB, Valkey.
**Final Recommendation:** **Valkey** — following Redis Inc.'s 2024 relicensing of Redis (7.4+) away from the permissive BSD-3-Clause license to the more restrictive RSALv2/SSPL dual license, Valkey (the Linux-Foundation-governed, BSD-licensed fork) is the licensing-safe, drop-in-compatible successor for a platform that intends to remain free to self-host and potentially offer managed tiers without license-risk. **DragonflyDB is flagged as a Future Consideration** — its multi-threaded architecture offers meaningfully higher throughput-per-node than single-threaded Redis/Valkey, which could reduce cache infrastructure cost at 10,000-dealer scale, but it is adopted only after Valkey is proven sufficient (avoid two migrations).
**Trade-off:** Valkey is younger than Redis as an independent project (forked 2024), accepted because the alternative (staying on relicensed Redis) carries the greater long-term commercial/licensing risk for a multi-tenant SaaS.
**ADR Reference:** [`adr/ADR-TSR-006-cache.md`](../adr/ADR-TSR-006-cache.md)

### 3.7 Queue

**Objective:** Choose the technology for (a) Job Queue, (b) Event Streaming, (c) Delayed Jobs — per Queue Contract (doc 003.5) and Architecture §26.
**Requirements:** Durable, per-tenant fair-share capable, DLQ support, visibility timeout / idempotent redelivery.
**Candidates:** Redis Streams, RabbitMQ, Kafka, NATS JetStream, BullMQ.
**Final Recommendation, split by use case:**

- **Job Queue** (Tool retries, Notification dispatch, short-lived async work — Queue Contract's `visibility_timeout`/`retry`/`dead_letter` fields): **BullMQ**, running on Valkey (§3.6) — mature Node.js job-queue library with native delayed jobs, priority, and DLQ support, minimal added infrastructure since it reuses the Valkey deployment.
- **Event Streaming** (Domain Events, doc 003 §12's 138 events, cross-Bounded-Context pub/sub with replay — Event Contract): **NATS JetStream** — chosen over Kafka for AOS's actual scale target (thousands of tenants, not hyperscale event volumes): materially lower operational burden, built-in KV/Object store useful for Registry caching, native multi-tenant subject-based partitioning, while still providing durable, replayable, at-least-once delivery. Kafka is not disqualified — it is the explicit scale-up migration path (§8 below) once/if event volume outgrows JetStream's comfortable operating envelope.
- **Delayed Jobs**: BullMQ's native delay for short/medium horizons (seconds to days — e.g., Follow-Up Reminder Policy from DDD §15); Scheduler Contract-driven cron/interval jobs (§3.12 of doc 003.5) for long-horizon/recurring triggers (e.g., Lead Expiry Policy).
- **RabbitMQ is not recommended** as a primary choice — its AMQP exchange/queue model is a worse structural fit for event-sourced replay (Architecture ADR-001) than JetStream's stream-log model, though it remains a credible alternative if the team has strong existing RabbitMQ operational expertise.
  **Trade-off:** Running BullMQ (on Valkey) and NATS JetStream side-by-side is two messaging technologies instead of one; accepted because they serve genuinely different access patterns (ephemeral job queue vs. durable replayable event log) that one technology alone (e.g., "just use Kafka for everything") would serve worse for the job-queue case's low-latency, high-cardinality, per-job semantics.
  **ADR Reference:** [`adr/ADR-TSR-007-queue.md`](../adr/ADR-TSR-007-queue.md)

### 3.8 Event Bus

**Objective:** Confirm the Event Bus technology underlying doc 002 §16 (Event Driven Architecture) and the Event Contract.
**Candidates:** NATS, Kafka, RabbitMQ.
**Final Recommendation:** **NATS JetStream** (see §3.7 rationale — this category is the same underlying decision as "Event Streaming" above, listed separately per the task brief). **Kafka** is the documented migration path once tenant/event volume crosses JetStream's comfortable ceiling (see `migration/migration-and-upgrade-strategy.md`) — Kafka's schema registry and consumer-group ecosystem maturity make it the natural next step, not a discarded option. **RabbitMQ** remains a non-recommended alternative for the reasons in §3.7.
**ADR Reference:** [`adr/ADR-TSR-008-event-bus.md`](../adr/ADR-TSR-008-event-bus.md)

### 3.9 Workflow Engine

**Objective:** Choose the durable execution engine implementing the Workflow Contract (doc 003.5 §4) and Architecture §15/ADR-007.
**Requirements:** Crash-resumable, saga/compensation support, multi-day-to-multi-week durable state (nurturing sequences), strong observability of in-flight workflow state.
**Candidates:** Temporal, Inngest, Trigger.dev, Internal Workflow Engine.
**Final Recommendation:** **Temporal** — its durable-execution model (workflow code re-executes deterministically from event history on any restart) is architecturally the closest match to the Workflow Contract's `state_machine`/`compensation`/resumability requirements of any available technology, and it is proven at multi-tenant SaaS scale elsewhere in the industry. **Inngest / Trigger.dev are flagged as a legitimate MVP-acceleration alternative** — both offer a materially lower operational setup cost and better out-of-box DX for a small early team, at the cost of less battle-tested durability guarantees at our eventual thousands-of-tenant target; if the team chooses to start there for speed, the migration path to Temporal must be planned from day one (see `migration/migration-and-upgrade-strategy.md`) rather than treated as a "maybe later." **Building a fully Internal Workflow Engine is not recommended** — Temporal already solves the hardest part of this problem (deterministic replay-based durability) to a standard that would take significant engineering time to match, and doing so would contradict Constitution §1.2 ("don't reinvent solved problems").
**Trade-off:** Temporal requires running and operating a non-trivial additional stateful service (Temporal Server + its own Postgres/Elasticsearch-backed persistence), a real ops cost, accepted because Workflow durability is core-domain-critical (DDD §2 Domain Vision — nurturing sequences must never silently die).
**ADR Reference:** [`adr/ADR-TSR-009-workflow-engine.md`](../adr/ADR-TSR-009-workflow-engine.md)

### 3.10 AI Gateway

**Objective:** Choose the layer translating the Model Router Contract's provider abstraction into concrete LLM provider API calls.
**Requirements:** Multi-provider support, fallback chain execution, cost metering, self-hostable (avoid a third party sitting between AOS and every LLM call it makes and bills for).
**Candidates:** LiteLLM, OpenRouter, Custom AI Gateway.
**Final Recommendation:** **LiteLLM** (self-hosted proxy mode) — open-source, supports the breadth of providers the Model Contract needs to route across, handles low-level protocol translation so AOS's own Model Router Contract implementation only needs to own routing _policy_ (cost ceilings, fallback chain order, tenant BYO-key handling) rather than every provider's request/response shape. **OpenRouter is not recommended as the primary path** — it is a third-party hosted intermediary that adds its own margin on top of every token and, more importantly, becomes an additional vendor dependency sitting directly in the platform's highest-frequency, cost-sensitive call path (violates the vendor-lock-in-avoidance principle in §1). It remains usable as an optional _fallback provider entry_ for exotic models not worth direct-integrating. **A fully Custom Gateway is not recommended** — LiteLLM already solves the protocol-translation problem well; building a custom equivalent would be reinventing a solved, actively-maintained open-source component (Constitution §1.2).
**Trade-off:** Self-hosting LiteLLM adds one more service to operate versus a hosted alternative, accepted to avoid a permanent per-token margin from a third-party gateway at platform scale.
**ADR Reference:** [`adr/ADR-TSR-010-ai-gateway.md`](../adr/ADR-TSR-010-ai-gateway.md)

### 3.11 LLM Orchestration

**Objective:** Choose (or reject) a framework for implementing the Planner/Reasoner/Reflection Contracts' execution logic.
**Requirements:** Must not impose its own opinionated Agent/Tool abstraction that conflicts with AOS's own Contract-First model (doc 003.5's Agent, Planner, Reasoner, Reflection, Tool contracts are already fully specified and must be the platform's own abstraction, per RULE-001/003/004).
**Candidates:** LangGraph, Mastra, CrewAI, AutoGen, Semantic Kernel, Custom Runtime.
**Final Recommendation:** **Custom Runtime**, built directly against the Agent/Planner/Reasoner/Reflection/Memory/Tool Contracts already specified in doc 003.5. Every framework in the candidate list (LangGraph, Mastra, CrewAI, AutoGen, Semantic Kernel) ships its own opinionated notion of "agent," "tool," and "memory" — adopting any of them wholesale as the platform's orchestration layer would mean either (a) fighting the framework's abstractions to force-fit our own Contracts on top, producing a leaky, doubly-abstracted system, or (b) abandoning our own Contract Specification in favor of the framework's model, which directly contradicts Constitution RULE-001/003/004 (Agents/Tools/Prompts must be resolved from AOS's own Registries, not a third-party framework's config format). **Selective internal reuse is still appropriate**: LangGraph's graph-based state machine execution model is a reasonable _internal implementation detail_ inside the Planner Contract's execution engine (i.e., a library dependency of one internal module, never exposed as the platform's own abstraction) — this is explicitly permitted and recommended as an implementation accelerator, evaluated properly at Core Runtime build time, not adopted as "the orchestration layer."
**Trade-off:** Building a custom runtime is more upfront engineering effort than adopting an off-the-shelf framework, but is the direct consequence of doc 003.5 already having specified AOS's own Agent/Planner/Reasoner/Reflection contracts in full — those contracts _are_ the orchestration model; a second, framework-supplied orchestration model would be redundant and conflicting, not complementary.
**ADR Reference:** [`adr/ADR-TSR-011-llm-orchestration.md`](../adr/ADR-TSR-011-llm-orchestration.md)

### 3.12 Vector Database

**Objective:** Choose the store for Semantic/Vector Memory (Memory Contract) and Knowledge embeddings (Knowledge Contract).
**Requirements:** Tenant-partitioned similarity search, acceptable latency at RAG-query time, operational simplicity where possible.
**Candidates:** Qdrant, Weaviate, Milvus, pgvector.
**Final Recommendation:** **pgvector** as the default — since PostgreSQL (§3.4) is already the primary OLTP store, using its `pgvector` extension for the shared/default tenant tier means one fewer database technology to operate, and its performance is adequate for the majority of tenants' embedding volume. **Qdrant recommended as the Enterprise/scale escape hatch** — once a tenant's (or the platform's aggregate) embedding volume/query load exceeds what pgvector comfortably serves, Qdrant is the migration target: chosen over Weaviate and Milvus for its simpler single-binary operational model, strong metadata/tenant-payload filtering performance (directly useful for tenant isolation at the vector-query level), and lighter resource footprint than Milvus's more complex distributed architecture.
**Trade-off:** Running two vector stores (pgvector default + Qdrant for scale) versus one, accepted for the same "start simple, escape-hatch when proven necessary" pattern applied to Database (§3.4).
**ADR Reference:** [`adr/ADR-TSR-012-vector-database.md`](../adr/ADR-TSR-012-vector-database.md)

### 3.13 Object Storage

**Objective:** Choose S3-compatible storage for Content/Creative assets, Knowledge documents, and backups.
**Candidates:** MinIO, Amazon S3, Cloudflare R2.
**Final Recommendation:** **Cloudflare R2** as the default for production — its zero-egress-fee model is directly cost-material for AOS's access pattern (Content/Creative assets and Knowledge documents are read frequently by both Agents at inference time and CDN-served Dashboard/customer-facing surfaces, and egress fees on S3 scale unfavorably with that pattern at thousands-of-tenant volume). **Amazon S3 retained as the fallback/enterprise option** for tenants with a specific cloud-residency or AWS-ecosystem-integration requirement (e.g., an Enterprise tenant already standardized on AWS). **MinIO recommended for self-hosted/dev/CI environments** and as the on-prem option for data-residency-constrained Enterprise tenants who cannot use any public cloud object store (Architecture §32 DR/residency considerations).
**Trade-off:** Standardizing on R2 as default introduces a Cloudflare dependency for the platform's primary object storage; mitigated by the S3-compatible API meaning a future migration to raw S3 or another S3-compatible provider requires no application-code change, only a configuration/credentials change.
**ADR Reference:** [`adr/ADR-TSR-013-object-storage.md`](../adr/ADR-TSR-013-object-storage.md)

### 3.14 Search Engine

**Objective:** Choose the search technology for Dashboard/CRM/Knowledge full-text search.
**Candidates:** Elasticsearch, OpenSearch, Meilisearch.
**Final Recommendation:** **Meilisearch** for tenant-facing product search (Dashboard lead/customer/inventory search, CRM lookup) — dramatically lower operational overhead than Elasticsearch/OpenSearch, fast relevance-tuned-out-of-the-box results, and a resource footprint appropriate for a feature that is not the platform's primary data store. **OpenSearch flagged as the future upgrade path** if/when analytics-grade full-text search at very large log/document scale becomes necessary — chosen over Elasticsearch specifically due to Elastic's 2021 relicensing away from the fully open Apache 2.0 license (same category of licensing-risk reasoning as the Redis→Valkey decision in §3.6); OpenSearch (the Apache-2.0-licensed, AWS/Linux-Foundation-adjacent fork) is the license-safe equivalent.
**Trade-off:** Meilisearch's feature set is narrower than Elasticsearch/OpenSearch's (no native aggregation/analytics engine), accepted because AOS's Analytics needs are already served by the dedicated Analytics Warehouse (Architecture §22), not by the search engine.
**ADR Reference:** [`adr/ADR-TSR-014-search-engine.md`](../adr/ADR-TSR-014-search-engine.md)

### 3.15 API Gateway

**Objective:** Choose the technology implementing Architecture §28 (API Gateway Architecture).
**Candidates:** Kong, Traefik, Envoy.
**Final Recommendation:** **Kong** — its plugin architecture is philosophically aligned with AOS's own Plugin-First principle (Constitution §3.1), and its plugin ecosystem has mature, battle-tested options for the multi-tenant rate-limiting, authentication, and request-transformation needs the API Gateway Architecture (doc 002 §28) specifies. **Traefik** is a credible, simpler alternative particularly strong for Kubernetes-native Ingress use cases and may be adopted for lower-stakes internal/dev-environment gateways, but its plugin ecosystem depth for enterprise multi-tenant auth/rate-limiting scenarios is thinner than Kong's at present. **Envoy** is not recommended as a standalone Gateway choice for AOS — it is more commonly the _data plane_ underneath a service-mesh control plane (e.g., Istio), which is more infrastructure than the platform's current scale target justifies; it remains a Future Consideration if/when a full service mesh becomes necessary.
**Trade-off:** Kong's plugin/Enterprise-tier feature split means some advanced capabilities may require Kong Enterprise licensing at scale; mitigated by Kong's open-source core covering AOS's near-term needs, with the licensing trade-off explicitly revisited at the 1,000-dealer cost checkpoint.
**ADR Reference:** [`adr/ADR-TSR-015-api-gateway.md`](../adr/ADR-TSR-015-api-gateway.md)

### 3.16 Authentication

**Objective:** Choose the identity/auth technology for Constitution §20 (Security Standards) and RULE-062 (RBAC enforcement).
**Candidates:** Keycloak, Auth0, Clerk, Supabase Auth.
**Final Recommendation:** **Keycloak** (self-hosted) — open-source, mature multi-tenant realm model that maps naturally onto AOS's Tenant/Branch/User/Role structure (DDD §9, §25), and critically avoids the per-MAU/per-tenant pricing that Auth0/Clerk/Supabase Auth all carry, which scales poorly against a target of thousands of dealer tenants each with many users. **Auth0** offers superior turnkey DX and is a reasonable choice for a much smaller-scale product, but its cost curve at AOS's target scale is the deciding disqualifier. **Clerk and Supabase Auth** are excellent for fast MVP building (strong DX, quick integration) and are flagged as a legitimate _early-prototype-only_ option, but are not recommended for the production multi-tenant platform for the same cost-at-scale reasoning, plus generally weaker enterprise SSO/realm-isolation maturity than Keycloak at this writing.
**Trade-off:** Self-hosting Keycloak requires the platform to own its own identity infrastructure operations (patching, HA, upgrade cycles) rather than outsourcing that to a vendor; accepted given Identity is explicitly a Generic Domain (DDD §4) where "good enough, well-operated, cost-controlled" beats "best-in-class managed convenience at unsustainable per-tenant cost."
**ADR Reference:** [`adr/ADR-TSR-016-authentication.md`](../adr/ADR-TSR-016-authentication.md)

### 3.17 Observability

**Objective:** Choose the tracing/metrics/logging instrumentation stack for Constitution §17/§25 and Architecture §23–25.
**Candidates:** OpenTelemetry, Grafana, Prometheus, Loki, Tempo, Jaeger.
**Final Recommendation:** **OpenTelemetry** as the vendor-neutral instrumentation standard across every service (traces, metrics, logs all emitted via OTel SDKs/collectors, matching Architecture §38's tracing recommendation) feeding a self-hostable **Grafana + Prometheus + Loki + Tempo ("LGTM") stack**: Prometheus for metrics, Loki for logs, Tempo for traces, Grafana as the unified dashboard/query layer across all three. **Jaeger is not separately adopted** — Tempo's native Grafana integration and its ability to correlate traces with Loki logs and Prometheus metrics in one pane makes it the better-integrated choice for AOS's stack than standalone Jaeger, even though Jaeger remains a fine tracing backend on its own.
**Trade-off:** Operating four LGTM components is more infrastructure than a single managed SaaS observability product, accepted for cost control at scale (see §23 Monitoring for the explicit cost-vs-Datadog/New-Relic comparison) and because OpenTelemetry instrumentation keeps the platform free to switch backends later without re-instrumenting code.
**ADR Reference:** [`adr/ADR-TSR-017-observability.md`](../adr/ADR-TSR-017-observability.md)

### 3.18 CI/CD

**Objective:** Choose the pipeline and deployment automation per Constitution §18/RULE-086–091.
**Candidates:** GitHub Actions, GitLab CI, ArgoCD.
**Final Recommendation:** **GitHub Actions** for build/test/CI (assuming GitHub as the source control host, the default for a TypeScript-first startup-to-scaleup team) paired with **ArgoCD** for GitOps-based Kubernetes deployment — ArgoCD's declarative, Git-as-source-of-truth deployment model directly satisfies Constitution RULE-086 (IaC-driven, traceable deployment) and integrates cleanly with the Terraform-provisioned Kubernetes clusters (§3.21). **GitLab CI** is not adopted as primary but is noted as the direct substitute if the organization ever standardizes on GitLab instead of GitHub — the CI/CD pattern (build → test → containerize → ArgoCD sync) is portable between the two.
**Trade-off:** Running both GitHub Actions (CI) and ArgoCD (CD) is two systems instead of one "CI/CD does everything" tool, accepted because GitOps-style deployment (ArgoCD reconciling cluster state to Git) is a materially safer and more auditable production deployment model than push-based CI-triggered deploys alone.
**ADR Reference:** [`adr/ADR-TSR-018-cicd.md`](../adr/ADR-TSR-018-cicd.md)

### 3.19 Container

**Objective:** Choose the container runtime/build tooling.
**Candidates:** Docker, Podman.
**Final Recommendation:** **Docker** — remains the ecosystem standard with the broadest CI/CD, base-image, and tooling compatibility; every other decision in this document (Kubernetes, ArgoCD, GitHub Actions) assumes Docker-format images and that compatibility is not worth trading away for Podman's rootless-by-default security advantage at this stage. **Podman is flagged as a Future Consideration** specifically for security-hardened Enterprise on-prem deployments where rootless container execution is a compliance requirement.
**ADR Reference:** [`adr/ADR-TSR-019-container.md`](../adr/ADR-TSR-019-container.md)

### 3.20 Orchestration

**Objective:** Confirm the container orchestration platform per Architecture §11 (Deployment Diagram) and §31 (Scalability Architecture).
**Candidates:** Kubernetes, Nomad, Docker Swarm.
**Final Recommendation:** **Kubernetes** (managed — EKS/GKE-class) — already assumed throughout Architecture doc 002's deployment diagrams and scalability model; its ecosystem (autoscaling, service mesh options, the vast operator/tooling landscape including ArgoCD, Kong, and Temporal's own K8s operators) is decisively the best-supported path for AOS's multi-region, multi-tenant, thousands-of-dealer scaling target. **Nomad** is simpler operationally but has a materially smaller ecosystem of ready-made operators for the specific stateful services (Temporal, Kafka/NATS, Postgres) AOS depends on. **Docker Swarm** is not recommended — its ecosystem momentum has stagnated relative to Kubernetes and it lacks the autoscaling sophistication Architecture §31 requires.
**ADR Reference:** [`adr/ADR-TSR-020-orchestration.md`](../adr/ADR-TSR-020-orchestration.md)

### 3.21 IaC

**Objective:** Choose the Infrastructure-as-Code tooling per Constitution RULE-086 and Architecture §32 (DR rebuild determinism).
**Candidates:** Terraform, Pulumi.
**Final Recommendation:** **Terraform** — the largest multi-cloud provider ecosystem and the deepest available operational talent pool, both directly relevant to Architecture §32's disaster-recovery requirement that infrastructure be deterministically rebuildable in a standby region by any qualified engineer, not just the original author. **Pulumi** is acknowledged as offering a materially nicer developer experience for a TypeScript-first team (infrastructure defined in the same language as the application), and is flagged as a valid alternative worth revisiting if the team's Terraform/HCL friction becomes a measured productivity problem — but Terraform's ecosystem maturity wins for the v1 decision.
**ADR Reference:** [`adr/ADR-TSR-021-iac.md`](../adr/ADR-TSR-021-iac.md)

### 3.22 Secret Management

**Objective:** Choose the secrets store satisfying Constitution RULE-060 (Tool Contract's `authentication` field resolution at call time).
**Candidates:** Vault, AWS Secrets Manager, Doppler.
**Final Recommendation:** **HashiCorp Vault** (self-hosted or HCP Vault managed) as the primary — its dynamic secrets, fine-grained per-tenant/per-Tool access policies, and audit logging match the Tool Contract's per-invocation credential resolution model and Constitution §20's least-privilege mandate most completely. **A cloud-native Secrets Manager (e.g., AWS Secrets Manager)** is an acceptable simpler default for teams already fully committed to a single cloud provider and wanting to defer Vault's operational complexity until it is clearly needed. **Doppler is recommended for development-environment secret distribution only** — its excellent local-dev DX is valuable, but production secret custody for a multi-tenant enterprise SaaS should not sit with a smaller third-party vendor by default.
**ADR Reference:** [`adr/ADR-TSR-022-secret-management.md`](../adr/ADR-TSR-022-secret-management.md)

### 3.23 Monitoring

**Objective:** Choose the day-to-day operational monitoring product (distinct from, but built on, the Observability stack in §3.17).
**Candidates:** Grafana Stack, Datadog, New Relic.
**Final Recommendation:** **Grafana Stack** (self-hosted, or Grafana Cloud as a managed middle-ground for a small early ops team) — primarily on cost-at-scale grounds: Datadog and New Relic's per-host/per-GB-ingested pricing models become materially expensive at the thousands-of-tenant, many-services scale AOS targets (Constitution §33 Cost Optimization), whereas the self-hosted LGTM stack's cost is infrastructure-bound rather than metered-per-signal. **Datadog is acknowledged as having superior out-of-box UX, APM auto-instrumentation polish, and incident-response tooling** — this is a real trade-off, not a dismissal, and is explicitly flagged for re-evaluation if the ops team's toil from self-hosting Grafana Stack exceeds the licensing savings at a given tenant scale.
**ADR Reference:** [`adr/ADR-TSR-023-monitoring.md`](../adr/ADR-TSR-023-monitoring.md)

### 3.24 Testing

**Objective:** Choose the test tooling for Constitution §19 (Testing Standards).
**Candidates:** Vitest, Jest, Playwright, Cypress.
**Final Recommendation:** **Vitest** for unit/integration tests — faster execution and native TypeScript/ESM support than Jest, and shares configuration/tooling with a Vite-based frontend build if one is adopted, reducing toolchain duplication. **Playwright** for end-to-end tests — broader multi-browser (including WebKit) support, materially faster parallel execution, and better CI-native tooling than Cypress at present. **Jest** remains an acceptable fallback wherever a specific dependency (e.g., a legacy library with Jest-only mocking support) requires it, rather than a hard rule against it. **Cypress** is not recommended as primary given Playwright's current advantages, though existing Cypress expertise on a hire is not a blocker to contributing.
**ADR Reference:** [`adr/ADR-TSR-024-testing.md`](../adr/ADR-TSR-024-testing.md)

### 3.25 Documentation

**Objective:** Choose the documentation publishing tooling for Constitution §22 (Documentation Standards).
**Candidates:** Docusaurus, MkDocs, Mintlify.
**Final Recommendation:** **Docusaurus** for the internal Engineering Handbook (this document series, docs 001–004 and beyond) — React-based, fully self-hostable, highly customizable, and versioning-friendly for a living constitutional document set. **Mintlify** for external-facing Developer/API/SDK documentation (once the Core Runtime and SDK exist) — modern DX, strong native OpenAPI/schema integration well-suited to publishing the Contract Specification's JSON Schemas (doc 003.5) as browsable API reference. **MkDocs** is not adopted — Docusaurus covers the same ground with a more actively maintained plugin ecosystem for a TypeScript-first team, though MkDocs remains a fine choice for teams preferring Python-based tooling.
**ADR Reference:** [`adr/ADR-TSR-025-documentation.md`](../adr/ADR-TSR-025-documentation.md)

---

## 4. AI Model Strategy

The Model Router Contract (doc 003.5 §14, §19 in doc 002) requires a concrete `routing_policy` per Agent category. This section defines that policy at the TSR level; the Model Registry (Registry Contract) is where it becomes a live, tenant-overridable configuration.

### 4.1 Routing Table

| Agent / Task Category                                                                               | Primary Model Tier                                                                                                                      | Why                                                                                                                                                                                                                                                                                                       | Fallback Chain                                                                                                                                                                                               | Cost Posture                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| CEO AI / COO AI (strategic planning, cross-context reasoning, Reflection at highest security_level) | **Claude — top reasoning tier**                                                                                                         | Longest-context, most reliable multi-step tool-use and instruction-following at the highest-stakes, lowest-frequency decision points (Agent Contract `security_level: restricted`); strong track record on agentic tool-calling reliability, which directly reduces Guardrail rejection/escalation churn. | Claude mid-tier → GPT top-tier (cross-provider redundancy per Model Contract `fallback`)                                                                                                                     | Low call volume, so premium-tier cost is affordable; hard `cost_limit`/`token_limit` still enforced per Agent Contract §4 invariant. |
| Marketing AI / Campaign Optimization                                                                | **Claude — mid reasoning tier**                                                                                                         | Strong balance of reasoning quality (budget/optimization judgment) and cost, for medium-frequency, medium-stakes decisions.                                                                                                                                                                               | GPT mid-tier                                                                                                                                                                                                 | Medium volume; tiered routing escalates to top-tier only when Reflection confidence is low (RULE-083 pattern).                       |
| Sales AI / Lead Scoring & Qualification                                                             | **Fast/cheap tier (Claude Haiku-class or GPT-mini-class)**                                                                              | Very high invocation frequency (every qualifying Lead interaction, DDD BR-008); latency and cost dominate the decision — reasoning demand per call is comparatively low (a scoring/classification task, not open-ended planning).                                                                         | Escalate to mid-tier automatically when Reflection confidence < tenant threshold (RULE-083), not a fixed fallback chain — this is confidence-driven tier escalation, distinct from provider-outage fallback. | Highest call volume in the platform; cost ceiling per Agent Contract `cost_limit` is tightest here.                                  |
| Conversational AI / Customer Chat                                                                   | **GPT — fast/current chat-optimized tier**                                                                                              | Very high frequency, strict latency requirement (customer is waiting live), and chat/conversational tuning is this tier's specific strength.                                                                                                                                                              | Claude Haiku-class as cross-provider fallback for provider outage.                                                                                                                                           | Highest-frequency, most latency-sensitive; Model Router's fallback must be transparent and fast (Architecture §19).                  |
| Research (broad web/knowledge synthesis, long-context grounding tasks)                              | **Gemini — long-context tier**                                                                                                          | Long context window and strong grounding/search-integration characteristics fit research-style, retrieval-heavy tasks better than pure chat-tuned models.                                                                                                                                                 | Claude mid-tier                                                                                                                                                                                              | Lower frequency, tolerant of somewhat higher per-call latency.                                                                       |
| Content Generation (ad copy, creative briefs)                                                       | **Claude — mid reasoning tier**                                                                                                         | Strong long-form writing quality and brand-voice consistency.                                                                                                                                                                                                                                             | GPT mid-tier                                                                                                                                                                                                 | Medium volume; Content Contract's Guardrail brand-safety check runs regardless of which model produced the draft.                    |
| Image Generation                                                                                    | **KIE (or equivalent specialized image-gen provider)**, invoked as a Tool (per Tool Contract), not via the text-completion Model Router | Image generation is a fundamentally different capability/cost/latency shape than text completion; modeling it as a Tool keeps the Model Router Contract focused on LLM text/reasoning routing while still gaining the same permission/cost-ceiling/circuit-breaker guarantees via the Tool Manager.       | Secondary image-gen provider Tool, same pattern as any Tool Contract fallback                                                                                                                                | Metered per generated asset; ties into Content Contract's Creative lifecycle.                                                        |
| Video Generation                                                                                    | **KIE (or equivalent), as a Tool**                                                                                                      | Same reasoning as Image Generation.                                                                                                                                                                                                                                                                       | Secondary provider Tool                                                                                                                                                                                      | Metered per generated asset; typically higher unit cost than image — flagged for tighter per-tenant quota (Tool Contract `quota`).   |
| Speech (STT / TTS)                                                                                  | **Whisper-class (STT)** + a dedicated TTS provider, both as Tools                                                                       | Whisper-class models are the de facto standard for cost-effective, high-accuracy transcription; STT/TTS are again a distinct capability shape from text completion, modeled as Tools.                                                                                                                     | Secondary STT/TTS provider Tool                                                                                                                                                                              | Relevant primarily for voice-channel omnichannel conversations (DDD §30 Future Extension).                                           |

### 4.2 Routing Strategy Explained

- **Tier, not vendor, is the primary routing key.** The Model Registry defines _tiers_ (e.g., "fast/cheap," "balanced," "top reasoning") and maps each Agent category to a tier; which specific vendor model currently fills that tier is a Model Registry configuration value, changeable without touching Agent code — this is precisely why the Model Router Contract exists (doc 003.5 §14, ADR-008 in doc 002).
- **Confidence-driven escalation is distinct from outage-driven fallback.** A low Reflection confidence score (RULE-083) escalates an invocation to a _higher-reasoning tier of the same or different provider_ for a re-attempt or hands off to human review; a provider _outage_ triggers the Model Contract's `fallback` chain to an equivalent-tier alternate provider. Both are described in the Model Router Architecture (doc 002 §19) but are functionally different triggers and must not be conflated in implementation.
- **Cost governance is enforced outside the Agent** (doc 002 ADR-018) — every routing decision above is still bounded by the invoking Agent's `cost_limit`/`token_limit` (Agent Contract) regardless of which model tier is selected.
- **Non-text-completion capabilities (image, video, speech) are deliberately routed as Tools, not as Model Router entries** — this keeps the Model Contract's schema (provider/model_name/capabilities/context_window/etc., all text-completion-shaped fields) clean, while still gaining full permission/cost/circuit-breaker governance via the Tool Manager/Tool Contract, which is capability-agnostic by design.
- **Multi-provider by construction, never single-provider by convenience** — every category above has a fallback, directly satisfying Constitution RULE-079/080 and avoiding the single-provider dependency risk the Model Router Architecture was built to eliminate.

---

## 5. Cost Analysis

**Full detailed breakdown and assumptions:** [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md). This section is the executive summary; all figures are **order-of-magnitude planning estimates** derived from the assumptions documented in that file (list prices / published pricing patterns as of this writing, not a vendor quote) — they exist to inform architecture and budgeting decisions, not to be treated as a committed budget.

### 5.1 Summary Table (estimated monthly cost, USD, all figures rounded)

| Category                                                         | 100 Dealers              | 1,000 Dealers             | 10,000 Dealers              |
| ---------------------------------------------------------------- | ------------------------ | ------------------------- | --------------------------- |
| Compute Infrastructure (Kubernetes nodes, Core Runtime services) | $1,500 – $3,000          | $8,000 – $15,000          | $50,000 – $90,000           |
| Database (PostgreSQL managed + CockroachDB Enterprise slice)     | $600 – $1,200            | $4,000 – $8,000           | $30,000 – $55,000           |
| Cache (Valkey managed/self-hosted)                               | $150 – $300              | $1,000 – $2,000           | $6,000 – $12,000            |
| Queue / Event Streaming (NATS JetStream + BullMQ infra)          | $200 – $400              | $1,500 – $3,000           | $10,000 – $18,000           |
| Vector Database (pgvector included in DB; Qdrant slice at scale) | included                 | $500 – $1,200             | $5,000 – $10,000            |
| Object Storage (R2, zero-egress)                                 | $50 – $150               | $500 – $1,200             | $4,000 – $8,000             |
| AI / LLM Inference (Model Router across all Agent categories)    | $3,000 – $7,000          | $25,000 – $55,000         | $220,000 – $480,000         |
| Observability / Monitoring (self-hosted LGTM stack infra)        | $300 – $600              | $2,000 – $4,000           | $12,000 – $22,000           |
| Traffic / CDN / Egress (Dashboard, API, webhook ingress)         | $200 – $400              | $1,500 – $3,000           | $10,000 – $20,000           |
| **Estimated Total (mid-point)**                                  | **~$8,000 – $13,000/mo** | **~$55,000 – $95,000/mo** | **~$400,000 – $715,000/mo** |

**Key takeaway:** AI/LLM inference dominates the cost structure at every scale (roughly 40–65% of total infrastructure spend), which is precisely why §4's tiered model-routing strategy (cheap/fast tier for high-frequency Lead Scoring and Conversational AI, premium tier reserved for low-frequency strategic Agents) and Constitution §33's per-tenant cost ceilings are the single highest-leverage cost control in the entire platform — more so than any individual infrastructure vendor choice in §3.

---

## 6. Compatibility Matrix

|                          | Postgres/CockroachDB                          | Valkey                          | NATS JetStream                 | Temporal                                | Kubernetes       | Kong                                                     |
| ------------------------ | --------------------------------------------- | ------------------------------- | ------------------------------ | --------------------------------------- | ---------------- | -------------------------------------------------------- |
| NestJS (TS backend)      | ✅ via Drizzle                                | ✅ native client                | ✅ native client               | ✅ TS SDK                               | ✅ (runs as pod) | ✅ (upstream service)                                    |
| Go services              | ✅ native driver                              | ✅ native client                | ✅ native client (first-class) | ✅ Go SDK (Temporal's native language)  | ✅               | ✅                                                       |
| Python (AI/data tooling) | ✅ psycopg/SQLAlchemy                         | ✅ redis-py (Valkey-compatible) | ✅ nats.py                     | ✅ Python SDK                           | ✅               | N/A (not gateway-fronted)                                |
| pgvector                 | ✅ (same instance)                            | N/A                             | N/A                            | N/A                                     | ✅               | N/A                                                      |
| Qdrant                   | separate service, tenant_id filter compatible | N/A                             | events on ingest via NATS      | N/A                                     | ✅               | N/A                                                      |
| LiteLLM                  | reads Model Registry from Postgres            | caches routing decisions        | publishes model.* events       | invoked from within Temporal Activities | ✅               | fronted by Kong for external model traffic if applicable |

All listed technologies are Kubernetes-deployable (self-hosted or managed-service-with-K8s-operator), satisfying Architecture §11's single deployment topology — no category in §3 requires an incompatible infrastructure substrate.

---

## 7. Dependency Matrix

| Depends On →                 | Postgres                                              | Valkey                         | NATS JetStream                 | Temporal                  | Vault                      | Keycloak                 |
| ---------------------------- | ----------------------------------------------------- | ------------------------------ | ------------------------------ | ------------------------- | -------------------------- | ------------------------ |
| NestJS Core Runtime services | Yes (via Drizzle)                                     | Yes (cache, BullMQ)            | Yes (event publish/subscribe)  | Yes (workflow invocation) | Yes (secret resolution)    | Yes (token verification) |
| Temporal                     | Yes (its own persistence store)                       | No                             | No (has its own task queue)    | —                         | Yes (worker credentials)   | No                       |
| Kong API Gateway             | No                                                    | Yes (rate-limit counters)      | No                             | No                        | Yes (upstream credentials) | Yes (OIDC plugin)        |
| LiteLLM                      | Yes (Model Registry read)                             | Yes (response cache, optional) | Yes (cost/usage event publish) | No                        | Yes (provider API keys)    | No                       |
| Grafana LGTM stack           | Optional (Grafana's own config store can be Postgres) | No                             | No                             | No                        | No                         | Yes (SSO login)          |

This matrix is the basis for build/deploy ordering in Core Runtime implementation: Vault and Postgres must exist before any other service; Keycloak before the API Gateway is traffic-serving; NATS JetStream before any Agent/Workflow that publishes/subscribes Domain Events.

---

## 8. Risk Register (Summary)

Full register: [`risk/risk-register.md`](../risk/risk-register.md). Top 5 by severity:

| ID       | Risk                                                                                                       | Severity    | Mitigation                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RISK-001 | LLM inference cost dominates spend and could spike unpredictably with tenant growth or model price changes | High        | Per-Agent/per-tenant `cost_limit` (Agent Contract) enforced outside Agent logic; tiered model routing (§4); real-time cost anomaly detection (Architecture §33) |
| RISK-002 | Temporal operational complexity underestimated by a small early team                                       | Medium-High | MVP option to start on Inngest/Trigger.dev with an explicit, planned migration path (see `migration/`) rather than an unplanned late migration                  |
| RISK-003 | NATS JetStream outgrown faster than expected at high tenant/event volume                                   | Medium      | Kafka migration path pre-documented (§8 of this doc, `migration/`), triggered by defined event-volume thresholds, not reactive firefighting                     |
| RISK-004 | Valkey/DragonflyDB ecosystem/tooling maturity lags Redis's at time of an incident                          | Medium      | Redis-protocol compatibility means client libraries and operational runbooks largely transfer; Valkey has Linux Foundation backing reducing abandonment risk    |
| RISK-005 | Self-hosted Grafana Stack ops burden exceeds savings vs. Datadog at some scale                             | Medium      | Explicit re-evaluation checkpoint at each cost-analysis tier (§5); Grafana Cloud as a managed middle-ground before reverting to Datadog                         |

---

## 9. Migration & Upgrade Strategy (Summary)

Full document: [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md). Every "default + escape hatch" decision in §3 (Database, Vector DB, Object Storage, Event Bus, Cache) has a documented trigger condition and migration path, not an open-ended "we'll figure it out later." Upgrade strategy for each technology follows Constitution §21 Versioning Strategy applied to infrastructure: pin versions explicitly, upgrade on a scheduled cadence with a staging-environment soak period, never auto-upgrade production.

---

## 10. Technology Roadmap (3–5 Years, Summary)

Full document: [`roadmap/technology-roadmap.md`](../roadmap/technology-roadmap.md). High-level horizon view:

- **Year 1:** Core Runtime on the stack decided here; single-region; Postgres RLS default tier only; NATS JetStream; MVP-speed Workflow option (Temporal or Inngest) locked in early.
- **Year 2:** Multi-region DR (Architecture §32) live; CockroachDB/Qdrant escape hatches activated for first Enterprise tenants; Kafka migration evaluated against real event-volume data.
- **Year 3:** Cost-driven infra re-evaluation checkpoint (Grafana Stack vs. Datadog, Kong OSS vs. Enterprise, DragonflyDB adoption) using two years of real usage data instead of estimates.
- **Years 4–5:** Selective Rust adoption for any proven hot-path bottleneck; service-mesh (Envoy/Istio) evaluation if multi-region service-to-service traffic complexity warrants it; continuous LLM model-tier re-routing as the model market evolves.

---

## 11. Roadmap — ENGINEERING TASK 005: AI Organization Design (Deliverables Only, Not Implemented)

Per the task instruction, this section lists the full deliverable set for the next Engineering Task, without implementing any of it.

`docs/005-AI-ORGANIZATION-DESIGN.md` should define:

1. **AI Organization Chart** — the full hierarchy of strategic, tactical, and operational AI Agents (CEO AI, COO AI, Marketing AI, Sales AI, and all Agent instances from DDD §9/§11), analogous to a human org chart, showing reporting/escalation lines expressed as Event Bus subscriptions and Workflow triggers (not direct calls, per RULE-002).
2. **Role Charter per Agent** — for every Agent in the org chart: mandate, decision rights, escalation boundary, and the specific Agent Contract instance it will be published as (cross-referencing doc 003.5 §2).
3. **Escalation & Delegation Model** — formal rules for when an Agent escalates to a human role (Sales, Manager, Dealer Admin) vs. another Agent vs. a higher-tier model (tying together DDD §24 Permission Matrix, Reflection Contract confidence thresholds, and Guardrail Engine policy).
4. **Inter-Agent Communication Protocol** — the catalog of which Agents publish/subscribe to which Domain Events (DDD §12), formalized as each Agent's `events.publishes`/`events.subscribes` per the Agent Contract.
5. **AI Governance Model** — who (which human role) owns/approves changes to which Agent's Registry entry, Prompt version, and Guardrail policy; ties to DDD §24 Permission Matrix and Constitution §8.1 ownership.
6. **Performance & Accountability Framework** — how each Agent's KPIs (DDD §28) roll up into an organization-wide AI performance scorecard, and what triggers an Agent being deprecated/retired/redesigned.
7. **Simulation & Onboarding Protocol** — how a new Agent is "hired" (drafted, simulated per the Simulation Contract, canary-released, promoted to active) — the AI-organization analogue of a human onboarding process.
8. **Conflict Resolution Model** — what happens when two Agents' recommendations conflict (e.g., Marketing AI wants to increase spend, Guardrail/Budget policy disagrees) — decision authority and tie-breaking rules.
9. **Cross-Tenant vs. Tenant-Scoped AI Roles** — which Agents operate globally (platform-level, e.g., a hypothetical fraud-detection Agent) vs. per-tenant (the default), formalized against the Agent Contract's `tenant_scope` field.
10. **AI Organization Diagrams** — org chart, escalation flow, and communication protocol, in Mermaid/PlantUML/ASCII, matching the visual style established in docs 002/003/003.5.

This is a **roadmap of deliverables only** — Engineering Task 005 itself, including any Agent org chart, role charter, or governance model content, is out of scope for this document and must not be implemented here.
