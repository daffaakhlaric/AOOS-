# 001 — AOS Engineering Constitution

**Status:** ACTIVE — Single Source of Truth
**Applies to:** Autonomous Automotive Operating System (AOS) — multi-tenant Agentic AI SaaS for automotive dealers
**Authority:** This document supersedes verbal instructions, ad-hoc requests, tickets, and prior conversation context whenever a conflict exists.
**Audience:** Every human engineer, every AI coding agent (Claude Code, Fabel AI, or any successor), every architect, every reviewer.

---

## 0. How This Document Works

0.1. This is the constitutional layer of AOS. All other documents (ADRs, design docs, runbooks, style guides) are subordinate to it. Where a subordinate document conflicts with this one, this one wins until this one is formally amended.

0.2. **Conflict Protocol (mandatory for AI agents):** If a new instruction, feature request, or ticket conflicts with any rule in this Constitution, the agent MUST:

1.  Stop before writing code.
2.  State explicitly which RULE(s) are in conflict and why.
3.  Propose at least one compliant alternative that achieves the requester's intent.
4.  Only proceed once a human explicitly approves an exception, and if approved, the exception MUST be recorded as an ADR (Architecture Decision Record) referencing the overridden RULE number.
5.  Never silently violate a rule to "get it working."

0.3. This document is versioned. Amendments require an ADR, a version bump (see §19 Versioning Strategy), and explicit human sign-off. AI agents MUST NOT self-amend this Constitution.

0.4. Every RULE is numbered permanently. Numbers are never reused, even if a rule is deprecated — deprecated rules are marked `[DEPRECATED]` and kept for historical traceability.

0.5. "MUST" / "MUST NOT" / "SHALL" are hard constraints — violation blocks merge. "SHOULD" is a strong default that requires a documented reason to deviate. "MAY" is a permitted option.

---

## 1. Engineering Philosophy

1.1. **AOS is a nervous system, not an app.** Dealers plug in; AI does the thinking; humans supervise exceptions. Every design decision is judged against: "does this let the system act autonomously, safely, and observably at scale?"

1.2. **Boring core, wild edges.** The runtime (event bus, registries, scheduler, queue, tool manager) must be extremely boring, predictable, and battle-tested. Innovation and experimentation happen in plugins (agents, tools, workflows, prompts) that snap into the boring core.

1.3. **Composability over configuration over code.** Prefer solving a new requirement by composing existing registry entries (tools, workflows, prompts) over writing new configuration, and prefer configuration over writing new code.

1.4. **Everything is a first-class citizen with an ID, a version, and an owner.** Agents, tools, workflows, prompts, models, events — each is a registry entry with metadata, not a floating function.

1.5. **Multi-tenancy is not a feature, it is the foundation.** Every line of code is written as if 5,000 dealers are already running on it concurrently.

1.6. **Autonomy requires guardrails, not blind trust.** The more autonomous an agent is, the more instrumented, sandboxed, and reversible its actions must be.

1.7. **Optimize for the third rewrite, not the first ship.** AOS is built to be replaced piece by piece (plugins swapped, models upgraded, workflows redefined) without ever requiring a rewrite of the core.

1.8. **Humans are the exception handler of last resort.** Sales/staff at a dealer only see Hot Leads and escalations — everything upstream of that is the AI's job, and every AI decision that reaches a human must be explainable.

1.9. **No silent failure.** A failure that is not logged, traced, and alertable did not "not happen" — it happened invisibly, which is worse.

1.10. **Cost and latency are architecture concerns, not afterthoughts.** Every AI call, every workflow, every event has a cost/latency budget declared up front.

---

## 2. Design Principles

2.1. **Single Responsibility per unit** — an Agent does one job, a Tool does one action, a Workflow orchestrates, nothing more.

2.2. **Open/Closed via plugins** — the core is closed for modification, open for extension via the Plugin, Registry, and Event mechanisms.

2.3. **Liskov substitution for interfaces** — any Tool/Agent implementing a contract must be swappable without breaking callers.

2.4. **Interface Segregation** — Agents depend on narrow Tool/Capability interfaces, never on a "god interface."

2.5. **Dependency Inversion** — Core domain logic depends on abstractions (ports); infrastructure (adapters) depends on the domain, never the reverse.

2.6. **Explicit over implicit** — no hidden globals, no magic side effects, no implicit tenant context. Context is always passed explicitly.

2.7. **Idempotency by default** — any operation that can be retried (and in a distributed async system, everything can) must be safe to run more than once.

2.8. **Immutability where possible** — events, prompts, and registry versions are immutable once published; changes create new versions.

2.9. **Fail fast, degrade gracefully** — validate early and loudly; when a dependency is down, degrade to a safe fallback rather than cascading failure.

2.10. **Design for observability before design for features** — if you can't answer "what did the system do and why" from logs/traces/metrics alone, the feature is not done.

---

## 3. Architecture Principles (Mandatory Pillars)

All of AOS MUST simultaneously satisfy these pillars. None is optional; they compose together.

3.1. **Plugin First** — Agents, Tools, Workflows, Channels, and Integrations are all plugins with a manifest, a version, and a lifecycle (install/enable/disable/uninstall) independent of the core runtime.

3.2. **Event Driven** — All cross-boundary communication (agent-to-agent, module-to-module, tenant-to-tenant-boundary) happens via the Event Bus. No direct synchronous coupling between business modules.

3.3. **Registry Driven** — Prompts, Workflows, Tools, Agents, Models, and Policies are never hardcoded; they are entries resolved at runtime from their respective Registries.

3.4. **Tool Driven** — Agents never touch external systems (APIs, DBs, browsers, messaging platforms) directly; all external effects go through the Tool Manager.

3.5. **Workflow Driven** — Multi-step business processes are declared as Workflow definitions (data), executed by a Workflow Engine, not encoded as imperative control flow spread across services.

3.6. **AI Native** — The system is designed assuming LLMs/agents are primary actors, with human-in-the-loop as a supervisory layer, not the other way around.

3.7. **Async First** — Default to asynchronous, event-driven, queue-backed execution. Synchronous request/response is the exception, reserved for user-facing reads and health checks.

3.8. **Domain Driven Design** — The system is organized around Bounded Contexts (Lead, Campaign, Content, Conversation, Analytics, Tenant/Billing, Identity) with explicit context maps and anti-corruption layers between them.

3.9. **SOLID** — Applied at every module boundary (see §2).

3.10. **Clean Architecture** — Dependencies point inward: Domain ← Application ← Infrastructure/Interface. Domain layer has zero framework/SDK imports.

3.11. **Hexagonal Architecture (Ports & Adapters)** — Every external dependency (LLM provider, WhatsApp/Meta API, CRM, database, vector store) is accessed through a Port interface with one or more swappable Adapters.

3.12. **CQRS where needed** — High-read modules (Analytics, Lead Scoring dashboards) separate command (write) models from query (read) models when read/write load or shape diverges significantly; not applied dogmatically everywhere.

3.13. **Dependency Injection** — All dependencies (ports, config, clients) are injected at composition root; no service reaches out to a global singleton to get a collaborator.

3.14. **Multi-Tenant** — Tenant isolation is enforced at every layer: data, queue, event, cache, secrets, rate limits, and cost accounting.

3.15. **Cloud Native** — Stateless services, horizontal scalability, container-first, config via environment/secret manager, health/readiness probes mandatory.

3.16. **Observability First** — Structured logs, distributed traces, and metrics are designed alongside the feature, not bolted on after.

---

## 4. Architecture Rules

4.1. The system is decomposed into Bounded Contexts; cross-context calls happen only via published Events or explicit Anti-Corruption Layer adapters, never via shared database tables.

4.2. Each Bounded Context owns its own data store (schema-level isolation minimum; database-level isolation for Tier 1 tenants).

4.3. No business module may import another business module's internal (non-public) code.

4.4. All public contracts between contexts (events, tool schemas, API DTOs) are versioned and backward-compatible for at least one deprecation window (see §19).

4.5. The Core Runtime (Event Bus, Registries, Tool Manager, Workflow Engine, Scheduler, Queue, Memory Service) exposes only stable, versioned interfaces; it MUST NOT contain business/domain logic.

4.6. Business logic lives in Agents, Workflows, and Domain Services — never in the Core Runtime, never in Tool adapters.

4.7. A Tenant Context object (tenant_id, plan, region, data-residency flag) is threaded through every request, event, job, and log line — no operation executes without a resolved tenant context.

---

## 5. Coding Standards

5.1. Every function/method has a single, testable purpose; if it needs "and" in its description, split it.

5.2. Public functions/classes/modules MUST have doc comments describing intent, inputs, outputs, and failure modes — not restating the code.

5.3. No function exceeds ~50 lines or a cyclomatic complexity threshold defined by the team's linter config; refactor into smaller units instead of suppressing the linter.

5.4. All I/O (network, disk, DB, LLM calls) is async/non-blocking; no blocking calls inside async execution contexts.

5.5. All external inputs (user input, LLM output, webhook payloads, tool results) are validated against an explicit schema before use — never trusted implicitly.

5.6. No magic numbers or magic strings; use named constants or config/registry values.

5.7. Errors are typed/classed (domain error hierarchy), never raw strings or generic exceptions, so callers can branch on error type.

5.8. Feature flags gate all new user-facing or risky behavior; flags are tenant-scopeable.

5.9. Dead code, commented-out code, and TODO-without-ticket are not permitted in merged code.

5.10. Every module has a corresponding automated test suite; code without tests does not merge (see §14 Testing Standards for coverage thresholds).

---

## 6. Naming Conventions

6.1. Agents are named `<Domain>Agent` (e.g., `LeadScoringAgent`, `NurturingAgent`, `ContentAgent`).

6.2. Tools are named `<Verb><Noun>Tool` (e.g., `SendWhatsAppMessageTool`, `FetchCrmLeadTool`).

6.3. Workflows are named `<Noun><Verb-ing/Process>Workflow` (e.g., `LeadNurturingWorkflow`, `CampaignOptimizationWorkflow`).

6.4. Events are named in past tense, domain-first: `<Domain>.<Entity><PastTenseVerb>` (e.g., `lead.created`, `lead.scored`, `campaign.budget_exhausted`).

6.5. Registry keys are lowercase, dot-namespaced, and versioned: `<domain>.<name>@<semver>` (e.g., `prompt.lead_qualification@2.1.0`).

6.6. Queue names follow `<tenant-scope>.<domain>.<purpose>` (e.g., `global.conversation.inbound`, `tenant.<id>.campaign.execute` only when tenant-dedicated queues are provisioned).

6.7. Database tables use `snake_case`, plural nouns, and always include `tenant_id` as the first column for tenant-scoped tables.

6.8. Environment variables are `SCREAMING_SNAKE_CASE`, prefixed by subsystem (`AOS_QUEUE_URL`, `AOS_LLM_DEFAULT_MODEL`).

6.9. Branch names: `feature/<ticket-id>-short-desc`, `fix/<ticket-id>-short-desc`, `chore/...`.

6.10. No abbreviations that aren't industry-standard (`cfg` no, `config` yes; `id` yes; `ctx` yes as it's ubiquitous in the domain).

---

## 7. Folder Structure Standards

7.1. Top-level separation by architectural layer, not by technical framework:

```
/core            # Runtime: event-bus, registries, tool-manager, workflow-engine, scheduler, queue, memory
/domain          # Bounded-context domain models, entities, value objects, domain services (framework-free)
/application     # Use-cases / application services orchestrating domain + ports
/adapters        # Infrastructure adapters implementing ports (LLM providers, WhatsApp, CRM, DB, cache)
/plugins
  /agents        # One folder per Agent plugin, each self-contained with its own manifest
  /tools         # One folder per Tool plugin
  /workflows     # Workflow definitions (data, not imperative code)
  /prompts       # Prompt templates (versioned)
/registries      # Registry seed/config definitions
/interfaces      # API (REST/GraphQL/gRPC), webhooks, admin UI backends
/shared          # Cross-cutting: logging, tracing, error types, validation utils
/tests
/docs
/infra           # IaC, deployment manifests
```

7.2. Each plugin (agent/tool/workflow) is self-contained in its own directory with a manifest file, its own tests, and no reach-into another plugin's internals.

7.3. Domain layer folders MUST NOT contain SDK/framework-specific imports (no LLM SDK, no HTTP client inside `/domain`).

7.4. Shared/common code lives in `/shared` only if used by 3+ modules; otherwise duplication is preferred over premature abstraction.

---

## 8. Plugin Standards

8.1. Every plugin (Agent, Tool, Workflow, Channel Adapter) ships with a manifest declaring: `id`, `version`, `type`, `description`, `capabilities`, `required_permissions`, `dependencies`, `owner`.

8.2. Plugins are installable/enableable/disableable per-tenant without a core redeploy.

8.3. A plugin MUST declare its required Tool permissions explicitly; the Tool Manager denies undeclared tool access at runtime.

8.4. Plugins MUST NOT modify core runtime state directly; all state changes go through published APIs/events.

8.5. A disabled or uninstalled plugin MUST leave the system in a consistent state (no orphaned scheduled jobs, no dangling event subscriptions).

8.6. Plugins are semantically versioned; the Registry can run multiple versions concurrently during a migration window (see §19).

8.7. Every plugin has an isolated test suite that can run without the full system booted (mockable ports).

8.8. A plugin failing its health/contract check at load time MUST be quarantined (not loaded) rather than crashing the core runtime.

---

## 9. Registry Standards

9.1. The following are Registries, each a versioned, queryable source of truth: Prompt Registry, Workflow Registry, Tool Registry, Agent Registry, Model Registry, Policy/Guardrail Registry.

9.2. No prompt, workflow definition, tool schema, agent config, or model routing rule may be hardcoded in application code — it MUST be fetched from its Registry at runtime.

9.3. Every Registry entry has: `id`, `version` (semver), `status` (draft/active/deprecated/retired), `created_by`, `created_at`, `tenant_scope` (global or tenant-specific override), and a changelog.

9.4. Registry entries are immutable once published; edits create a new version, never mutate history in place.

9.5. Registries support tenant-level overrides layered on top of global defaults (e.g., a dealer can have a custom prompt variant), resolved via explicit precedence rules (tenant override > tenant plan tier default > global default).

9.6. Every Registry write is itself an audited event (`registry.<type>.published`) so changes are traceable and replayable.

9.7. Registry reads are cached at the edge with explicit TTL and cache-busting on publish; agents never bypass the Registry to read a local hardcoded copy "for speed."

---

## 10. Workflow Standards

10.1. Workflows are declarative definitions (steps, transitions, conditions, retries, timeouts) stored in the Workflow Registry — not imperative code paths buried in a service.

10.2. Every workflow step declares: its Tool/Agent invocation, input schema, output schema, timeout, retry policy, and compensation/rollback action (saga pattern) if it mutates external state.

10.3. Long-running workflows (nurturing sequences, multi-day campaigns) are durable — state persists across process restarts (durable execution / event-sourced workflow state).

10.4. A workflow MUST be resumable from its last completed step after a crash; no workflow re-executes side-effecting steps that already succeeded (idempotency keys required).

10.5. Workflows emit lifecycle events (`workflow.started`, `workflow.step_completed`, `workflow.failed`, `workflow.completed`) to the Event Bus for observability and downstream triggers.

10.6. A workflow MUST declare a maximum execution time and a maximum cost budget; exceeding either triggers an alert and, per policy, a halt.

10.7. Human-in-the-loop checkpoints (e.g., "confirm before spending >$X on ad campaign") are first-class workflow step types, not bolted-on exceptions.

---

## 11. Agent Standards

11.1. Every Agent is a plugin (see §8) with a single, clearly scoped domain responsibility (Lead Scoring, Nurturing, Campaign Ops, Content Generation, Conversation/Chat, Analytics/Insights).

11.2. Agents MUST NOT call external APIs directly — all effects go through the Tool Manager (RULE-001).

11.3. Agents MUST NOT call other Agents directly — all inter-agent communication goes through the Event Bus (RULE-002).

11.4. Agents are stateless between invocations; any state they need is fetched from the Memory Service or Domain Services, never held in process-local memory across requests.

11.5. Every Agent declares its allowed Tools, its allowed Models (see §21), its cost ceiling per invocation, and its escalation policy (when to hand off to a human).

11.6. Agents log every decision with the reasoning trace (prompt version, model used, tool calls made, confidence score) sufficient to reconstruct "why did the AI do this" after the fact.

11.7. An Agent's output that will trigger an irreversible or costly external action (spend money, send bulk messages, delete data) MUST pass through a Policy/Guardrail check before execution.

11.8. Agents are independently deployable/upgradable; upgrading one Agent's model or prompt version MUST NOT require redeploying other Agents.

---

## 12. Tool Standards

12.1. A Tool is the only sanctioned way to reach an external system (CRM, WhatsApp/Meta, ad platforms, database, browser, email, SMS, payment).

12.2. Every Tool declares an explicit input/output JSON schema; the Tool Manager validates both before and after execution.

12.3. Every Tool declares its side-effect classification: `read-only`, `reversible-write`, `irreversible-write` — irreversible-write tools require explicit policy approval to invoke.

12.4. Tools are idempotent or provide an idempotency key parameter; retries must not double-send a WhatsApp message or double-charge a card.

12.5. Tools implement their own circuit breaker and timeout; a failing external dependency degrades that Tool, not the whole Agent runtime.

12.6. Tool credentials/secrets are tenant-scoped and resolved via the Secrets Manager at call time — never embedded in Tool code or Agent prompts.

12.7. Every Tool call is logged with input (redacted for PII per §17), output, latency, cost, and success/failure — feeding cost accounting per tenant.

---

## 13. Memory Standards

13.1. Agent memory is split into: Working Memory (current task/session, ephemeral), Episodic Memory (conversation/interaction history), and Semantic Memory (long-term facts/preferences per lead/tenant, typically vector-indexed).

13.2. All memory is tenant-partitioned at the storage layer — no memory query can cross a tenant boundary, enforced at the query layer, not just application logic.

13.3. Memory writes are namespaced by entity (lead, conversation, tenant) with explicit TTL/retention policy per memory type; nothing is retained indefinitely by default (see §16 data retention under Security).

13.4. Memory reads used to construct a prompt are logged (which memory IDs were retrieved) so any AI output can be traced back to the context that produced it.

13.5. Personally Identifiable Information (PII) stored in memory MUST be tagged as such and subject to the same encryption/redaction/right-to-erasure rules as primary data stores (§17).

---

## 14. Event Standards

14.1. All events are published to the Event Bus with a versioned schema (`event_type`, `version`, `tenant_id`, `occurred_at`, `payload`, `trace_id`).

14.2. Events are named in past tense and represent facts that already happened, not commands (`lead.created`, not `create_lead`).

14.3. Event payloads are additive-only across versions within a major version (new optional fields only); breaking changes require a new event major version, with both versions published during the deprecation window.

14.4. Consumers MUST be tolerant readers — ignore unknown fields, never fail on schema additions.

14.5. Every event carries a `trace_id`/`correlation_id` propagated from its originating request/workflow for end-to-end tracing.

14.6. Events are the only sanctioned mechanism for one Bounded Context to notify another; no context polls another context's database.

14.7. Event delivery is at-least-once; all consumers MUST be idempotent (dedupe via event ID).

---

## 15. Queue Standards

15.1. All async work (tool execution, workflow steps, notifications) is dispatched via durable queues, not fire-and-forget in-process async calls.

15.2. Queues are tenant-fair-scheduled: no single tenant's volume can starve other tenants' jobs (fair-share or per-tenant rate limiting at the queue consumer level).

15.3. Every queued job carries a tenant context, an idempotency key, a max-retry count, and a dead-letter destination.

15.4. Dead-lettered jobs MUST trigger an alert and be inspectable/replayable by an operator — never silently dropped.

15.5. Poison messages (jobs that fail deterministically) are automatically quarantined after N retries to prevent queue-blocking loops.

15.6. Queue consumers are horizontally scalable and stateless; scaling a queue's throughput never requires code changes, only consumer count/config.

---

## 16. Scheduler Standards

16.1. All time-based/recurring triggers (campaign checks, follow-up reminders, nightly analytics rollups) are declared in the Scheduler Registry, not as ad-hoc cron scattered across services.

16.2. Scheduled jobs are tenant-aware and respect tenant timezone/business-hours configuration where relevant (e.g., don't message a lead at 3am local time).

16.3. Every scheduled job has an owner (which Agent/Workflow it triggers), an execution SLA, and a missed-run alerting policy.

16.4. The Scheduler guarantees at-least-once triggering with idempotent downstream handling — a missed tick must be caught up, not silently skipped, unless explicitly configured as skip-if-missed.

16.5. Scheduled jobs MUST be individually pausable/disableable per tenant without affecting other tenants' schedules.

---

## 17. Logging Standards

17.1. All logs are structured (JSON), never free-text string concatenation, and include `tenant_id`, `trace_id`, `agent/tool/workflow id`, `severity`, `timestamp`.

17.2. PII and secrets are never logged in plaintext; a redaction layer scrubs known-sensitive fields before logs leave the process.

17.3. Log levels are used consistently: `DEBUG` (dev-only detail), `INFO` (lifecycle events), `WARN` (recoverable anomaly), `ERROR` (failed operation, needs attention), `CRITICAL` (system-threatening, pages on-call).

17.4. Every AI decision log includes enough context (prompt version, model, input summary, output, confidence) to reconstruct the decision without needing to replay the LLM call.

17.5. Logs are shipped to a centralized, tenant-filterable log store with retention policy defined per log level and per compliance requirement.

---

## 18. Error Handling Standards

18.1. Errors are classified into a domain hierarchy: `ValidationError`, `NotFoundError`, `ConflictError`, `DependencyError` (external system failure), `PolicyViolationError`, `RateLimitError`, `InternalError`.

18.2. Every external call (LLM, API, DB) is wrapped with timeout, retry-with-backoff, and circuit breaker; retry policy is explicit per call type, never "retry forever."

18.3. Errors crossing a module boundary are never swallowed silently; they are logged, classified, and either handled, retried, or propagated as a typed error.

18.4. User-facing/agent-facing error messages never leak internal stack traces, secrets, or infrastructure details.

18.5. Every irreversible-action failure (a message that failed mid-send, a payment that failed mid-charge) triggers a compensation action or an explicit reconciliation job — the system never assumes "probably fine."

18.6. Circuit breakers on external dependencies (LLM providers, WhatsApp API, CRM) trip per-provider and trigger automatic fallback (secondary model/provider) where one is configured.

---

## 19. Testing Standards

19.1. Minimum automated test coverage: 80% line coverage for `/domain` and `/application`, 70% for `/adapters`, with critical paths (payment, tenant isolation, message sending) at effectively 100% via explicit test cases regardless of aggregate coverage numbers.

19.2. Every Tool has a contract test verifying its input/output schema against the live (or sandboxed) external API, run in CI on a schedule to catch upstream API drift.

19.3. Every Agent has prompt-regression tests: a fixed evaluation set of inputs with expected output ranges/classifications, run whenever the prompt or model changes.

19.4. Every Workflow has an integration test that runs it end-to-end against mocked Tools/Agents, verifying step ordering, retries, and compensation logic.

19.5. Multi-tenancy isolation is tested explicitly: automated tests that assert Tenant A's request can never read/write Tenant B's data, memory, or queue.

19.6. Chaos/failure-injection tests (dependency down, timeout, malformed payload) are run for every Tool and every critical Workflow before release.

19.7. No PR merges with reduced coverage on touched files without an explicit, reviewed justification.

---

## 20. Security Standards

20.1. All tenant data is isolated at the storage layer (row-level security or schema/database-per-tenant depending on tier); application-layer filtering alone is insufficient.

20.2. Secrets (API keys, tokens, credentials) are never stored in code, config files, or environment files committed to version control; they live only in a Secrets Manager, resolved at runtime.

20.3. All data in transit is encrypted (TLS 1.2+); sensitive data at rest (PII, credentials, payment references) is encrypted at rest.

20.4. Role-Based Access Control (RBAC) is enforced at the API layer for every endpoint; least-privilege is the default for every service account and every human role.

20.5. All inbound webhook/API payloads are authenticated (signature verification) and validated against schema before processing.

20.6. LLM prompts and outputs are treated as untrusted input/output: prompt-injection defenses (input sanitization, output validation, tool-call allowlisting) are mandatory for any Agent that ingests external/user text.

20.7. PII has a defined retention and right-to-erasure workflow; a tenant or lead's data deletion request is fulfillable within the compliance-mandated window across all stores (primary DB, memory, logs, backups where feasible).

20.8. Every production access to tenant data by an internal human operator is logged and auditable (break-glass access is time-boxed and alerts the tenant's admin where required).

20.9. Dependency and container images are scanned for known vulnerabilities in CI; critical/high vulnerabilities block release.

20.10. Rate limiting and abuse detection are applied per-tenant and per-API-key to prevent one tenant's compromised credential from impacting others.

---

## 21. Versioning Strategy

21.1. All public contracts (APIs, event schemas, tool schemas, registry entries, plugin manifests) follow Semantic Versioning (MAJOR.MINOR.PATCH).

21.2. Breaking changes require a MAJOR version bump and a minimum deprecation window (default 90 days) during which both old and new versions are supported.

21.3. Database schema migrations are additive and backward-compatible within a deploy cycle (expand/contract pattern); destructive migrations (drop column/table) only occur after the reading code no longer references them, in a subsequent release.

21.4. AI Model versions used by each Agent are pinned explicitly in the Model Registry; model upgrades are opt-in per tenant/agent, never a silent global swap.

21.5. This Constitution itself is versioned; every amendment is logged with date, author, and rationale in a changelog section at the bottom of this file.

---

## 22. Documentation Standards

22.1. Every Bounded Context, Agent, Tool, and Workflow has a README covering purpose, inputs/outputs, dependencies, and failure modes.

22.2. Every significant architectural decision is captured as an ADR (Architecture Decision Record): context, decision, alternatives considered, consequences.

22.3. Registry entries (prompts, workflows) include human-readable descriptions and change rationale, not just the machine-readable definition.

22.4. API and event schemas are documented in a machine-readable spec (OpenAPI/JSON Schema/AsyncAPI) kept in sync with implementation via CI validation, not hand-maintained separately.

22.5. Documentation is versioned alongside code; a PR that changes behavior without updating relevant docs is incomplete.

---

## 23. AI Model Standards

23.1. Model selection per Agent/task is resolved via the Model Registry (routing rules by task type, cost tier, latency requirement), never hardcoded to a single provider/model in Agent code.

23.2. Every Agent/task declares a fallback model chain (primary → secondary → tertiary) to survive provider outages or rate limits.

23.3. Model calls are cost-tracked per tenant, per agent, per workflow, feeding into tenant billing and system-wide cost alerting.

23.4. Prompts are never hardcoded (RULE-003); they are Registry entries with version history and regression tests (§19.3).

23.5. All AI-generated content or decisions that reach an end customer (lead) or that trigger spend MUST pass through a Guardrail/Policy check (tone, compliance, hallucination/factuality checks where applicable, brand safety).

23.6. Confidence scores or uncertainty signals are captured with every Agent decision where the underlying model supports them, and used to drive escalation thresholds (e.g., low-confidence lead scoring routes to human review).

23.7. Model provider credentials and rate limits are tenant-isolated where the pricing model requires it (e.g., BYO-key tenants vs. platform-pooled tenants) and never cross-shared.

23.8. A/B testing or gradual rollout of new prompt/model versions is supported natively via the Registry's versioning and tenant-scoping, not via manual code branches.

---

## 24. Deployment Standards

24.1. All infrastructure is defined as code (IaC); no manual production changes via console/UI.

24.2. Deployments are zero-downtime (rolling, blue-green, or canary) with automated rollback on health-check regression.

24.3. Every service exposes liveness and readiness probes; orchestration never routes traffic to a not-ready instance.

24.4. Config differs by environment (dev/staging/prod) via environment-scoped configuration, never via code branches (`if env == 'prod'` in business logic is forbidden).

24.5. New Agent/Tool/Workflow plugins are deployable to a subset of tenants (canary tenants) before global rollout.

24.6. Every deployment is traceable to a commit, a change ticket, and an approving reviewer; deployment history is auditable.

---

## 25. Monitoring Standards

25.1. Every service, Agent, Tool, and Workflow exposes metrics: request rate, error rate, latency (p50/p95/p99), and cost, taggable by tenant.

25.2. Distributed tracing (OpenTelemetry or equivalent) instruments every cross-service and cross-plugin call, correlated by `trace_id`.

25.3. SLOs are defined per critical path (e.g., "inbound chat reply p95 < 5s", "hot lead detection to sales notification < 2 min") with automated alerting on burn-rate.

25.4. Dashboards exist per Bounded Context and per tenant-tier, accessible to on-call without requiring log spelunking as the first step.

25.5. Anomaly detection (cost spikes, error-rate spikes, unusual tenant behavior) triggers automated alerts, not just manual dashboard review.

---

## 26. Performance Standards

26.1. Every user-facing synchronous path has a declared latency budget; exceeding it is a bug, not a backlog item.

26.2. Caching is applied deliberately (Registry reads, model routing decisions, frequently-read lead/tenant data) with explicit invalidation strategy — never cache-and-hope.

26.3. The system is load-tested to its stated multi-tenant scale target (thousands of dealers) before claiming production-readiness for a new major capability.

26.4. Expensive operations (bulk content generation, campaign optimization runs, analytics rollups) are async/batched and rate-limited to protect shared infrastructure.

26.5. Database queries are reviewed for tenant-scoped index usage; no query pattern may risk a full-table scan across all tenants' data.

---

## 27. Hard Rules Registry (RULE-001 → RULE-115)

> These are the enforceable, atomic rules. Each is independently checkable in code review. Numbers are permanent; deprecated rules are marked but never renumbered.

**Agent / Tool / Event Boundaries**

- **RULE-001** — Agents MUST NOT call external APIs directly. All API access goes through the Tool Manager.
- **RULE-002** — Agents MUST NOT call other Agents directly. All inter-agent communication goes through the Event Bus.
- **RULE-003** — Prompts MUST NOT be hardcoded. All prompts come from the Prompt Registry.
- **RULE-004** — Workflows MUST NOT be hardcoded. All workflows come from the Workflow Registry.
- **RULE-005** — Every Agent MUST be a plugin, addable/removable without modifying core runtime code.
- **RULE-006** — Every Tool MUST be a plugin with an explicit input/output schema.
- **RULE-007** — Every Tool MUST declare its side-effect class (read-only / reversible-write / irreversible-write).
- **RULE-008** — Irreversible-write Tool invocations MUST pass a Policy/Guardrail check before execution.
- **RULE-009** — Agents MUST declare their allowed Tool list; the Tool Manager MUST deny undeclared tool calls at runtime.
- **RULE-010** — Agents MUST be stateless between invocations; no in-process state survives across requests.

**Registry Discipline**

- **RULE-011** — No Registry entry (prompt/workflow/tool/agent/model config) may be mutated in place; changes create a new version.
- **RULE-012** — Every Registry entry MUST declare status (draft/active/deprecated/retired).
- **RULE-013** — Registry publishes MUST emit an auditable event (`registry.<type>.published`).
- **RULE-014** — Tenant-level Registry overrides MUST resolve via explicit precedence (tenant override > plan tier default > global default), never ambiguous merge logic.
- **RULE-015** — Agents/Workflows MUST resolve Registry entries at runtime, never bundle a local cached copy at build time as the source of truth.

**Multi-Tenancy**

- **RULE-016** — Every tenant-scoped database table MUST include `tenant_id` and enforce row-level isolation at the storage layer.
- **RULE-017** — No query, cache key, queue name, or memory namespace may omit tenant scoping.
- **RULE-018** — Automated cross-tenant isolation tests MUST exist and pass before any release touching data access code.
- **RULE-019** — One tenant's job volume MUST NOT be able to starve another tenant's queue throughput (fair-share enforcement required).
- **RULE-020** — Tenant data residency/region requirements MUST be enforced at the infrastructure routing layer, not left to application-level convention.

**Architecture / Layering**

- **RULE-021** — The Domain layer (`/domain`) MUST NOT import any framework or external SDK.
- **RULE-022** — Dependencies MUST point inward: Infrastructure → Application → Domain, never the reverse.
- **RULE-023** — Cross-Bounded-Context communication MUST occur only via Events or explicit Anti-Corruption Layer adapters, never shared tables.
- **RULE-024** — The Core Runtime MUST NOT contain business/domain logic.
- **RULE-025** — Every external dependency MUST be accessed through a Port interface with a swappable Adapter (Hexagonal Architecture).
- **RULE-026** — All cross-cutting dependencies (DB client, LLM client, config, logger) MUST be injected at the composition root, never globally resolved inside business logic.
- **RULE-027** — A Bounded Context MUST own its own data store; no direct cross-context table joins.

**Workflow Engine**

- **RULE-028** — Every workflow step MUST declare timeout, retry policy, and compensation/rollback action if it mutates external state.
- **RULE-029** — Workflow execution state MUST be durable and resumable after a process crash.
- **RULE-030** — Side-effecting workflow steps MUST use idempotency keys to prevent duplicate execution on retry/resume.
- **RULE-031** — Every workflow MUST declare a maximum execution time and maximum cost budget.
- **RULE-032** — Workflow lifecycle transitions MUST emit events (`workflow.started`, `.step_completed`, `.failed`, `.completed`).
- **RULE-033** — Workflow steps that spend money or send bulk communications above a configured threshold MUST include a human-in-the-loop checkpoint unless explicitly whitelisted by policy.

**Events & Queues**

- **RULE-034** — Every event MUST carry `event_type`, `version`, `tenant_id`, `occurred_at`, `trace_id`.
- **RULE-035** — Event schema changes MUST be additive within a major version; breaking changes require a new major version published alongside the old one during the deprecation window.
- **RULE-036** — Event consumers MUST be tolerant readers — ignore unknown fields, never fail on additive schema changes.
- **RULE-037** — Event consumers MUST be idempotent, deduplicating by event ID (at-least-once delivery is assumed).
- **RULE-038** — Every queued job MUST carry a tenant context, idempotency key, max-retry count, and dead-letter destination.
- **RULE-039** — Dead-lettered jobs MUST trigger an alert and remain inspectable/replayable; they MUST NOT be silently dropped.
- **RULE-040** — Poison messages MUST auto-quarantine after N retries to prevent queue-blocking loops.

**Scheduler**

- **RULE-041** — All recurring/time-based triggers MUST be declared in the Scheduler Registry, not ad-hoc cron in service code.
- **RULE-042** — Scheduled jobs MUST respect tenant timezone/business-hours configuration when the job affects lead-facing communication.
- **RULE-043** — Every scheduled job MUST have a declared owner, execution SLA, and missed-run alert.
- **RULE-044** — Scheduled jobs MUST be individually pausable per tenant without affecting other tenants.

**Logging & Error Handling**

- **RULE-045** — All logs MUST be structured (JSON) and include `tenant_id`, `trace_id`, and the emitting component's ID.
- **RULE-046** — PII and secrets MUST NOT appear in plaintext logs; a redaction layer is mandatory.
- **RULE-047** — Every AI decision log MUST include prompt version, model used, and enough context to reconstruct the decision.
- **RULE-048** — Errors crossing a module boundary MUST be typed (domain error hierarchy), never raw strings or generic exceptions.
- **RULE-049** — Every external call MUST be wrapped with timeout, retry-with-backoff, and circuit breaker.
- **RULE-050** — Errors MUST NOT be silently swallowed; every catch MUST log, classify, and either handle, retry, or propagate.
- **RULE-051** — User/agent-facing error messages MUST NOT leak stack traces, secrets, or infrastructure details.
- **RULE-052** — Failed irreversible-action executions (partial sends, partial charges) MUST trigger compensation or reconciliation — never assumed fine.

**Testing**

- **RULE-053** — Minimum 80% test coverage for `/domain` and `/application` layers; 70% for `/adapters`.
- **RULE-054** — Every Tool MUST have a contract test validating its schema against the live/sandboxed external API.
- **RULE-055** — Every Agent MUST have prompt-regression tests run on prompt or model change.
- **RULE-056** — Every Workflow MUST have an end-to-end integration test with mocked Tools/Agents.
- **RULE-057** — Cross-tenant isolation MUST be covered by explicit automated tests before release.
- **RULE-058** — No PR may merge with reduced coverage on touched files without documented, reviewed justification.
- **RULE-059** — Critical paths (payment, tenant isolation, message sending, data deletion) require explicit test cases regardless of aggregate coverage percentage.

**Security**

- **RULE-060** — Secrets MUST NOT be stored in code, config files, or version control; only in a Secrets Manager.
- **RULE-061** — All data in transit MUST use TLS 1.2+; sensitive data at rest MUST be encrypted.
- **RULE-062** — Every API endpoint MUST enforce RBAC with least-privilege defaults.
- **RULE-063** — All inbound webhook/API payloads MUST be signature-verified and schema-validated before processing.
- **RULE-064** — LLM inputs and outputs MUST be treated as untrusted; prompt-injection defenses are mandatory for any Agent ingesting external text.
- **RULE-065** — PII MUST have a defined retention policy and a fulfillable right-to-erasure workflow across all stores.
- **RULE-066** — Internal human access to production tenant data MUST be logged and auditable; break-glass access is time-boxed.
- **RULE-067** — Dependencies and container images MUST be vulnerability-scanned in CI; critical/high findings block release.
- **RULE-068** — Rate limiting and abuse detection MUST be applied per-tenant and per-API-key.
- **RULE-069** — A compromised or leaked credential for one tenant MUST NOT be able to impact another tenant's data or spend.

**Versioning**

- **RULE-070** — All public contracts (APIs, events, tool schemas, registry entries, plugin manifests) MUST follow Semantic Versioning.
- **RULE-071** — Breaking changes REQUIRE a MAJOR version bump and a minimum 90-day deprecation window with dual support.
- **RULE-072** — Database migrations MUST follow expand/contract; destructive migrations only after no code references the old shape.
- **RULE-073** — AI Model versions per Agent MUST be pinned in the Model Registry; upgrades are opt-in per tenant/agent, never silently global.
- **RULE-074** — Every amendment to this Constitution MUST be logged in its changelog with date, author, and rationale.

**Documentation**

- **RULE-075** — Every Bounded Context, Agent, Tool, and Workflow MUST have a README covering purpose, I/O, dependencies, failure modes.
- **RULE-076** — Every significant architectural decision MUST be captured as an ADR.
- **RULE-077** — API and event schemas MUST be documented in a machine-readable spec kept in sync via CI validation.
- **RULE-078** — A PR that changes behavior without updating relevant docs is considered incomplete and MUST NOT merge.

**AI Model Governance**

- **RULE-079** — Model selection per Agent/task MUST be resolved via the Model Registry's routing rules, never hardcoded to a single provider in Agent code.
- **RULE-080** — Every Agent/task MUST declare a fallback model chain to survive provider outages or rate limits.
- **RULE-081** — All model calls MUST be cost-tracked per tenant, per agent, per workflow.
- **RULE-082** — AI-generated content or decisions reaching an end customer or triggering spend MUST pass a Guardrail/Policy check.
- **RULE-083** — Low-confidence Agent decisions (below a configured threshold) MUST escalate to human review rather than auto-execute.
- **RULE-084** — Model provider credentials/rate limits MUST be tenant-isolated where pricing/BYO-key arrangements require it.
- **RULE-085** — New prompt or model versions MUST support gradual/canary rollout via Registry tenant-scoping before global release.

**Deployment & Infra**

- **RULE-086** — All infrastructure MUST be defined as code; no manual production console changes.
- **RULE-087** — Deployments MUST be zero-downtime with automated rollback on health-check regression.
- **RULE-088** — Every service MUST expose liveness and readiness probes.
- **RULE-089** — Environment-specific behavior MUST be driven by configuration, never by `if env == 'prod'`-style code branches.
- **RULE-090** — New Agent/Tool/Workflow plugins MUST be canary-releasable to a tenant subset before global rollout.
- **RULE-091** — Every production deployment MUST be traceable to a commit, a change ticket, and an approving reviewer.

**Monitoring & Performance**

- **RULE-092** — Every service/Agent/Tool/Workflow MUST expose rate, error, latency (p50/p95/p99), and cost metrics, taggable by tenant.
- **RULE-093** — Every cross-service and cross-plugin call MUST be instrumented with distributed tracing correlated by `trace_id`.
- **RULE-094** — Critical paths MUST have declared SLOs with automated burn-rate alerting.
- **RULE-095** — Cost, error-rate, and abnormal-tenant-behavior anomalies MUST trigger automated alerts, not rely on manual dashboard review.
- **RULE-096** — Every user-facing synchronous path MUST have a declared latency budget; exceeding it is treated as a defect.
- **RULE-097** — Caching layers MUST have an explicit invalidation strategy; "cache and hope" is prohibited.
- **RULE-098** — Expensive bulk operations (content batches, campaign optimization runs, analytics rollups) MUST be async, batched, and rate-limited.
- **RULE-099** — No database query pattern may risk a full scan across all tenants' data; tenant-scoped indexing is mandatory.
- **RULE-100** — The platform MUST be load-tested against its stated multi-tenant scale target before a new major capability is declared production-ready.

**Human-in-the-Loop & Business Guardrail**

- **RULE-101** — Sales/dealer staff MUST only be surfaced Hot Leads (or explicit escalations) by default; the AI is responsible for all upstream qualification, nurturing, and follow-up.
- **RULE-102** — Every "Hot Lead" handoff to a human MUST include the AI's reasoning trace and confidence score, not just the raw contact.
- **RULE-103** — Any autonomous action with direct customer-facing communication impact (mass SMS/WhatsApp blast, price-sensitive offer) MUST be governed by a rate/volume policy per tenant to prevent runaway spam.
- **RULE-104** — Campaign budget-spending Agents MUST enforce a hard ceiling per tenant per period that cannot be exceeded even under Agent error, enforced outside the Agent itself (at the Tool/Policy layer).
- **RULE-105** — A tenant admin MUST be able to pause any Agent's autonomous actions for their tenant instantly, without requiring a platform-wide deploy or restart.

**Governance / Meta**

- **RULE-106** — No AI coding agent may silently violate a rule in this Constitution to satisfy a feature request; conflicts MUST be surfaced per the Conflict Protocol (§0.2) before code is written.
- **RULE-107** — Any approved exception to a rule MUST be recorded as an ADR referencing the specific RULE number overridden.
- **RULE-108** — This Constitution MUST NOT be self-amended by an AI agent; amendments require explicit human sign-off.
- **RULE-109** — Every new Bounded Context, Agent type, or Tool category introduced to the system MUST be reviewed against this Constitution before its first implementation PR.
- **RULE-110** — Naming conventions (§6) are enforced by linter/CI check where automatable, not left to reviewer memory alone.
- **RULE-111** — Folder structure (§7) violations (e.g., domain layer importing an SDK) MUST fail CI, not just code review.
- **RULE-112** — Any plugin failing its manifest/contract validation at load time MUST be quarantined, never allowed to crash the core runtime.
- **RULE-113** — Cost ceilings (per Agent invocation, per workflow, per tenant per period) MUST be configured before a new Agent/Workflow is enabled in production, not added retroactively after a cost incident.
- **RULE-114** — Every new external integration (Tool) MUST have its credentials, rate limits, and failure modes documented in its manifest before being enabled for any tenant.
- **RULE-115** — When this Constitution and a new business requirement conflict, this Constitution is presumed correct until formally amended — the burden of proof is on the new requirement, not on the existing rule.

---

## 28. Glossary

- **Agent** — An autonomous plugin unit that makes decisions within a bounded domain, using Models, Tools, and Memory.
- **Tool** — A plugin providing the only sanctioned path to an external system/effect.
- **Workflow** — A declarative, versioned definition of a multi-step business process executed by the Workflow Engine.
- **Registry** — A versioned, queryable store of Prompts, Workflows, Tools, Agents, Models, or Policies — never hardcoded.
- **Event Bus** — The sole channel for cross-boundary, asynchronous communication between modules/agents.
- **Tenant** — A single dealer account; the unit of isolation across data, cost, and configuration.
- **Hot Lead** — A lead the AI has qualified as sales-ready, handed off to human Sales with reasoning trace attached.
- **Guardrail/Policy** — A pre-execution check gating irreversible, costly, or customer-facing AI actions.
- **ADR** — Architecture Decision Record documenting a significant, non-obvious design decision and its rationale.

---

## 29. Changelog

| Version | Date       | Author                        | Change                                                                                                                             |
| ------- | ---------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2026-07-31 | AOS Architecture (Prompt 001) | Initial publication of the Engineering Constitution: philosophy, principles, 27 standards sections, and RULE-001 through RULE-115. |

---

**End of Constitution v1.0.0.** All future prompts, tickets, and implementation work for AOS are evaluated against this document. Any AI agent implementing AOS features MUST re-read this file before generating code and MUST invoke the Conflict Protocol (§0.2) whenever a request appears to violate a rule herein.
