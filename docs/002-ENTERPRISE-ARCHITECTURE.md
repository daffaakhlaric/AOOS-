# 002 — AOS Enterprise Architecture Blueprint

**Status:** ACTIVE — Sole architecture reference prior to implementation
**Governs under:** [`001-ENGINEERING-CONSTITUTION.md`](./001-ENGINEERING-CONSTITUTION.md) (the "Constitution"). Every design decision below traces to a Constitution RULE or Principle. Where this document would require violating a RULE, the conflict is called out explicitly (see §0) rather than silently resolved.
**Scope:** System design only. No implementation code, no agent code, no tool code, no workflow code.

---

## 0. Constitution Conformance Check

Before drafting this blueprint, [`001-ENGINEERING-CONSTITUTION.md`](./001-ENGINEERING-CONSTITUTION.md) was read in full. No conflicts were found between the requested blueprint scope and the Constitution — every architectural element requested (Event Bus, Registries, Tool Manager, Workflow Runtime, Model Router, Memory, Queue, Scheduler, Multi-Tenancy, Security, Observability) is already mandated by Constitution §3 (Architecture Principles) and §27 (Hard Rules). This document is the concretization of those mandates into system structure, diagrams, and technology choices.

If a future request conflicts with a RULE, this document's owning section will be annotated with a `⚠ CONFLICT` block referencing the RULE number, per Constitution §0.2, rather than silently deviating.

---

## 1. Executive Summary

AOS (Autonomous Automotive Operating System) is a multi-tenant, AI-native SaaS platform that runs the entire digital-marketing-to-sales-handoff pipeline for automotive dealers autonomously: lead discovery, nurturing, campaign execution and optimization, content generation, omnichannel conversation, follow-up, and analytics — surfacing only Hot Leads to human Sales (Constitution RULE-101).

The platform is built on seven core runtime pillars — **Event Bus, Registries, Tool Manager, Workflow Runtime, Agent Runtime, Model Router, Memory Service** — surrounded by a **Queue**, a **Scheduler**, an **API Gateway**, and full-stack **Observability**. All business capability (Agents, Tools, Workflows, Prompts) is delivered as versioned plugins resolved from Registries at runtime — never hardcoded (RULE-001 through RULE-005).

The architecture targets thousands of concurrently active dealer tenants, each fully isolated at the data, queue, memory, cost, and configuration layers (RULE-016 through RULE-020), while sharing a common, horizontally scalable, cloud-native runtime.

This document is the single pre-implementation reference. Every subsequent implementation prompt (agent build-out, tool build-out, workflow build-out) must be traceable to a component defined here.

---

## 2. Product Architecture

**Objective:** Define the product-level capability map before touching system structure.

**Responsibilities:** Translate the five business objectives (AI does marketing, finds Hot Leads, nurtures, runs & optimizes campaigns, creates content, replies to chat, follows up, analyzes; Sales only receives Hot Leads) into named product modules.

**Components:**

```
Product Modules
├── Lead Intelligence        (discovery, scoring, Hot Lead detection)
├── Nurturing & Engagement   (drip sequences, follow-up, re-engagement)
├── Campaign Operations      (planning, execution, budget, optimization)
├── Content Studio           (ad copy, creative briefs, social/content gen)
├── Conversational AI        (omnichannel inbound chat/reply)
├── Analytics & Insights     (funnel, attribution, cohort, ROI)
├── CRM Automation           (sync, dedupe, lifecycle stage automation)
└── Tenant & Billing         (onboarding, plan, usage-based billing)
```

**Dependencies:** Each product module maps 1:1 to a Bounded Context (Constitution §3.8, DDD).

**Input:** Business objectives from Prompt 001 context; dealer operational data (inventory, CRM, ad accounts).

**Output:** A Bounded Context map used to scope every subsequent Agent/Tool/Workflow.

**Sequence:** Business objective → Bounded Context → Agent(s) responsible → Workflow(s) implementing the process → Tools invoked.

**Failure Scenario:** A product capability is built without a clear Bounded Context owner, causing logic to leak across modules.

**Recovery Strategy:** Enforce Context Mapping review (ADR-004) before any Agent is registered against a module.

**Scaling Strategy:** New product modules (e.g., Finance & Insurance upsell) are added as new Bounded Contexts without touching existing ones (Open/Closed, Constitution §2.2).

**Best Practice:** Keep the product module list small and named after business capability, not technical function.

**Trade Off:** Strict DDD boundaries add short-term coordination overhead (context maps, ACLs) in exchange for long-term independent evolvability.

---

## 3. High Level Architecture

**Objective:** Show how a request/event flows from the outside world through the whole platform.

```
                         ┌─────────────────────────┐
                         │   Dealer Admin Portal    │
                         │  (Dashboard / Web App)   │
                         └────────────┬────────────┘
                                      │  HTTPS
                                      ▼
                         ┌─────────────────────────┐
                         │      API Gateway         │◄──── Omnichannel Webhooks
                         │ (Auth, RateLimit, Tenant)│      (WhatsApp, IG, FB, Web Chat, SMS)
                         └────────────┬────────────┘
                                      ▼
                         ┌─────────────────────────┐
                         │      Agent Runtime        │
                         │ (Planner + Reflection)   │
                         └───────┬─────────┬────────┘
                                 ▼         ▼
                    ┌────────────────┐ ┌────────────────┐
                    │ Workflow Runtime│ │  Event Bus      │◄──► Scheduler
                    └───────┬────────┘ └───────┬────────┘
                            ▼                  ▼
                    ┌────────────────┐ ┌────────────────┐
                    │  Tool Manager   │ │     Queue       │
                    └───────┬────────┘ └───────┬────────┘
                            ▼                  ▼
                 ┌────────────────────────────────────┐
                 │        External Services            │
                 │ CRM / Ads Platforms / Messaging /    │
                 │ Payment / Email / SMS                │
                 └────────────────────────────────────┘

        (Cross-cutting, touching every layer above)
        ┌───────────────┬───────────────┬───────────────┬───────────────┐
        │  Registries    │  Memory Service│ Model Router  │ Observability │
        └───────────────┴───────────────┴───────────────┴───────────────┘
```

**Responsibilities:** Show the seven pillars (Gateway, Agent Runtime, Workflow Runtime, Tool Manager, Event Bus, Queue, Scheduler) plus four cross-cutting services (Registries, Memory, Model Router, Observability).

**Components:** As diagrammed above.

**Dependencies:** Every layer depends only on the layer(s) directly below/adjacent, never skips or reaches backward (Constitution RULE-022).

**Input:** Dealer admin actions, inbound customer messages, scheduled triggers, external webhooks.

**Output:** Autonomous actions (messages sent, campaigns adjusted, content published) and Hot Lead handoffs to Sales.

**Sequence:** Trigger → Gateway authenticates/tenant-resolves → Agent Runtime plans → Workflow Runtime orchestrates steps → Tool Manager executes external effects → Event Bus/Queue propagate results → Observability records everything.

**Failure Scenario:** Any single pillar down (e.g., Tool Manager) must not cascade-fail the Agent Runtime; Agents degrade to a "cannot act, escalate" state.

**Recovery Strategy:** Circuit breakers at every pillar boundary (RULE-049); Dead Letter Queues for stuck jobs (RULE-039).

**Scaling Strategy:** Each pillar is an independently scalable stateless service group.

**Best Practice:** No pillar bypasses another — an Agent never opens a raw HTTP client instead of the Tool Manager (RULE-001).

**Trade Off:** More indirection/hops than a monolith, in exchange for pluggability, isolation, and independent scaling.

---

## 4. Context Diagram

**Objective:** Show AOS's boundary against the outside world (C4 Level 1 preview).

```
                     ┌──────────────┐        ┌──────────────┐
                     │ Dealer Admin  │        │  Sales Staff  │
                     └──────┬───────┘        └──────┬───────┘
                            │                        │
                            ▼                        ▼
                 ┌────────────────────────────────────────┐
                 │                AOS Platform              │
                 │   (Autonomous Automotive Operating       │
                 │            System — Multi-Tenant)        │
                 └───┬───────┬────────┬────────┬───────┬───┘
                     │       │        │        │       │
                     ▼       ▼        ▼        ▼       ▼
                 ┌──────┐┌───────┐┌───────┐┌───────┐┌────────┐
                 │ CRM   ││ Ads   ││Messaging││Payment││ LLM     │
                 │Systems││Platforms││(WA/IG/FB)││Gateways││Providers│
                 └──────┘└───────┘└───────┘└───────┘└────────┘
                            ▲
                            │
                     ┌──────┴───────┐
                     │  End Customer │
                     │    (Lead)      │
                     └───────────────┘
```

**Responsibilities:** Establish AOS's system boundary and its external actors/systems.

**Components:** Dealer Admin, Sales Staff, End Customer (Lead), CRM Systems, Ads Platforms, Messaging Channels, Payment Gateways, LLM Providers.

**Dependencies:** AOS depends on external system availability; none of these externals depend on AOS internals (Adapter pattern, RULE-025).

**Input:** All actor/system interactions cross the boundary via the API Gateway or Tool Manager adapters only.

**Output:** Autonomous marketing/sales actions visible to Leads; Hot Lead notifications visible to Sales Staff; reporting visible to Dealer Admin.

**Sequence:** External actor → AOS boundary (Gateway or Webhook) → internal processing → external effect (Tool call) or internal record.

**Failure Scenario:** An external system (e.g., an Ads Platform) is down or rate-limiting.

**Recovery Strategy:** Tool-level circuit breaker + fallback + alert (RULE-049), never a platform-wide outage from one external dependency.

**Scaling Strategy:** New external system integrations are added as new Tool Adapters without touching the context boundary.

**Best Practice:** No actor or external system is ever granted direct internal access — everything crosses through Gateway or Tool Manager.

**Trade Off:** Every external integration requires an adapter layer instead of direct SDK use, costing initial integration time for long-term swappability.

---

## 5. C4 Model

### 5.1 Level 1 — System Context

(See §4 Context Diagram — identical view, C4-labelled.) AOS is one system; actors are Dealer Admin, Sales Staff, End Customer; external systems are CRM, Ads, Messaging, Payment, LLM Providers.

### 5.2 Level 2 — Container Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                              AOS Platform                          │
│                                                                     │
│  ┌───────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │  Web App   │  │  API Gateway  │  │  Agent Runtime │  │ Workflow │ │
│  │ (Dashboard)│─▶│  (Auth/Rate/  │─▶│  (Planner +    │─▶│ Runtime  │ │
│  │            │  │   Tenant Ctx) │  │   Reflection)  │  │          │ │
│  └───────────┘  └───────────────┘  └───────────────┘  └────┬─────┘ │
│                                                              ▼       │
│  ┌───────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │  Registry  │◄─┤  Model Router │◄─┤  Tool Manager  │◄─┤  Queue   │ │
│  │  Service   │  │               │  │                │  │          │ │
│  └───────────┘  └───────────────┘  └───────┬───────┘  └──────────┘ │
│                                              ▼                      │
│  ┌───────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │  Memory    │  │  Event Bus    │  │  Scheduler     │  │Observ-   │ │
│  │  Service   │  │               │  │                │  │ability   │ │
│  └───────────┘  └───────────────┘  └───────────────┘  └──────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

Containers: Web App (SPA), API Gateway, Agent Runtime, Workflow Runtime, Tool Manager, Model Router, Registry Service, Memory Service, Event Bus, Queue, Scheduler, Observability Stack. Each is independently deployable (Constitution §3.15 Cloud Native).

### 5.3 Level 3 — Component Diagram (Agent Runtime container, representative)

```
┌───────────────────────── Agent Runtime ─────────────────────────┐
│  ┌───────────┐   ┌───────────┐   ┌────────────────┐              │
│  │  Planner   │──▶│ Executor  │──▶│ Reflection      │             │
│  │            │   │           │   │ Engine          │             │
│  └───────────┘   └─────┬─────┘   └────────┬───────┘              │
│                        ▼                   ▼                      │
│                ┌───────────────┐   ┌───────────────┐              │
│                │ Tool Invoker   │   │ Confidence/    │             │
│                │ (via Tool Mgr) │   │ Guardrail Check│             │
│                └───────────────┘   └───────────────┘              │
└───────────────────────────────────────────────────────────────────┘
```

**Objective (§5 overall):** Provide progressively zoomed-in architectural views per the C4 model, from system context to component internals.

**Responsibilities:** Level 1 shows scope; Level 2 shows deployable containers; Level 3 shows internal components of a container (illustrated for Agent Runtime; the same discipline applies to Workflow Runtime, Tool Manager, etc.).

**Dependencies:** Level 3 components depend only on other components within the same container plus injected ports (RULE-026).

**Input/Output:** Input — a Task/Plan request from a Workflow step; Output — an Action (Tool invocation) or an Escalation event.

**Sequence:** Planner decomposes goal → Executor runs plan step-by-step via Tool Invoker → Reflection Engine evaluates outcome/confidence → loop or escalate.

**Failure Scenario:** Planner produces a plan calling an undeclared Tool.

**Recovery Strategy:** Tool Manager permission check rejects the call (RULE-009); Reflection Engine logs and requests a re-plan or escalates.

**Scaling Strategy:** Agent Runtime instances are stateless and horizontally scaled behind the Workflow Runtime's dispatch.

**Best Practice:** Keep Planner and Executor separate components so planning strategy can evolve independent of execution mechanics.

**Trade Off:** Separating Planner/Executor/Reflection adds internal hops versus a single monolithic "agent loop," in exchange for independent testability (RULE-055 prompt-regression tests target the Planner specifically).

---

## 6. Component Diagram (Platform-Wide)

**Objective:** Show component-level relationships across the whole platform, not just one container.

```
Registries ──▶ Agent Runtime ──▶ Planner ──▶ Workflow Runtime ──▶ Tool Manager ──▶ Tool Adapters ──▶ External APIs
     ▲              │                              │                    │
     │              ▼                              ▼                    ▼
     │        Model Router ──▶ LLM Providers   Event Bus          Policy/Guardrail Engine
     │              │                              │
     │              ▼                              ▼
     └────── Memory Service              Queue ──▶ Scheduler
```

**Responsibilities:** Registries feed configuration/behavior into Agent Runtime and Workflow Runtime; Model Router mediates all LLM calls; Memory Service supplies context; Event Bus/Queue mediate all async coordination; Policy/Guardrail Engine gates risky Tool calls.

**Dependencies:** Every arrow above is a Port/Adapter relationship (RULE-025); no component reaches around another.

**Input/Output:** Input — tenant/business events and schedules; Output — external effects (RULE-001, RULE-002 compliant, i.e., always via Tool Manager/Event Bus).

**Sequence:** See §8 Runtime Interaction Diagram for a concrete walk-through.

**Failure Scenario:** Model Router's primary LLM provider is unavailable mid-plan.

**Recovery Strategy:** Model Router fails over to the declared fallback chain (RULE-080) transparently to the Agent.

**Scaling Strategy:** Each component scales independently; Model Router and Tool Manager are the most call-heavy and are scaled first under load.

**Best Practice:** Treat this diagram as the canonical map reviewers check new Agents/Tools/Workflows against.

**Trade Off:** A rich component graph is harder to onboard newcomers to than a simple layered MVC, but is necessary at this system's scale and autonomy level.

---

## 7. Runtime Architecture

**Objective:** Define what "runtime" means in AOS — the live, executing system composed of stateless compute plus durable state stores.

**Responsibilities:** Host Agent Runtime, Workflow Runtime, and Tool Manager as containerized, autoscaled services; maintain durable Workflow/Queue/Event state independent of any single compute instance.

**Components:** Compute layer (containers/pods), Durable State layer (Workflow state store, Queue, Event log), Registry cache layer, Model Router connection pool.

**Dependencies:** Compute is stateless and depends on the Durable State layer for anything that must survive a restart (RULE-029).

**Input:** Incoming triggers (API calls, events, schedule ticks).

**Output:** Completed workflow runs, emitted events, tool side effects.

**Sequence:** Trigger received → routed to an available stateless Agent/Workflow Runtime instance → instance reads/writes durable state → instance may terminate/restart without losing progress.

**Failure Scenario:** A Workflow Runtime pod crashes mid-execution of a multi-step nurturing sequence.

**Recovery Strategy:** Durable, event-sourced workflow state allows any other pod to resume from the last completed step (RULE-029, RULE-030 idempotency keys).

**Scaling Strategy:** Horizontal Pod Autoscaling on CPU/queue-depth metrics; no vertical scaling dependency.

**Best Practice:** Never hold workflow/session state in local process memory beyond a single step's execution.

**Trade Off:** Durable state persistence per step adds write latency versus in-memory execution, traded for crash-resilience required at thousands-of-tenants scale.

---

## 8. Runtime Interaction Diagram

**Objective:** Show a concrete cross-component interaction over time for a representative use case: inbound WhatsApp message → Hot Lead handoff.

```
Customer      Gateway      Agent Runtime    Workflow Runtime   Tool Manager   Event Bus    Memory
   │             │               │                 │               │            │           │
   │─msg────────▶│               │                 │                │           │           │
   │             │─tenant ctx───▶│                 │                │           │           │
   │             │               │─fetch history───┼────────────────┼───────────┼──────────▶│
   │             │               │◄─────────────────┼────────────────┼───────────┼───────────│
   │             │               │─plan(reply)─────▶│                │           │           │
   │             │               │                  │─invoke ToolMgr▶│           │           │
   │             │               │                  │                │─send WA──▶(external)  │
   │             │               │                  │◄───ok──────────│           │           │
   │             │               │                  │─emit lead.scored ─────────▶│           │
   │             │               │                  │                            │─if hot──▶ Sales Notify Workflow
```

**Responsibilities:** Demonstrate that no two adjacent boxes skip the Event Bus/Tool Manager mediation.

**Components:** Gateway, Agent Runtime, Workflow Runtime, Tool Manager, Event Bus, Memory Service, downstream Sales Notify Workflow.

**Dependencies:** Every external effect (sending WhatsApp) is a Tool Manager call; every cross-workflow trigger (Hot Lead → Sales Notify) is an Event Bus publish, not a direct function call (RULE-002, RULE-023).

**Input:** Inbound customer message webhook.

**Output:** Sent reply + (conditionally) a Hot Lead notification to Sales.

**Sequence:** As diagrammed.

**Failure Scenario:** WhatsApp send fails after the reply was "decided" but before delivery confirmation.

**Recovery Strategy:** Tool Manager idempotency key + retry-with-backoff (RULE-004 in Tool Standards / RULE-049); on final failure, compensating event `message.send_failed` triggers manual/automated reconciliation (RULE-052).

**Scaling Strategy:** Each hop is queue-buffered where synchronous latency isn't required (e.g., lead.scored is fully async).

**Best Practice:** Keep the customer-facing reply path (top of diagram) latency-optimized and synchronous-ish; push everything else (scoring, analytics, notifications) fully async.

**Trade Off:** The synchronous reply path has a tighter SLO (RULE-096) and thus fewer hops than the async tail, which is intentional layering, not inconsistency.

---

## 9. Data Flow Diagram

**Objective:** Track how data (not control) moves and transforms across the system.

```
[Raw Inbound Message] ──▶ [PII Redaction Layer] ──▶ [Conversation Store]
                                                          │
                                                          ▼
[Lead Profile Store] ◄── [Lead Scoring Agent] ◄── [Memory Service: Episodic + Semantic]
        │
        ▼
[Hot Lead Event] ──▶ [CRM Sync Tool] ──▶ [Dealer CRM]
        │
        ▼
[Analytics Warehouse] ──▶ [Dashboards / Reports]
```

**Responsibilities:** Ensure PII is redacted/tagged at ingestion (RULE-046), before it reaches logs or general-purpose memory.

**Components:** Ingestion, Redaction, Conversation Store, Memory Service, Lead Profile Store, CRM Sync Tool, Analytics Warehouse.

**Dependencies:** Analytics Warehouse is fed only via events (`lead.*`, `campaign.*`, `conversation.*`), never a direct read-replica of transactional PII stores, to keep the ACL boundary intact (RULE-023).

**Input:** Every inbound customer interaction and every AI decision.

**Output:** Tenant-scoped analytics datasets, CRM-synced lead records, Hot Lead events.

**Sequence:** Ingest → redact/tag → persist → derive (score) → branch (notify/analytics).

**Failure Scenario:** Redaction layer bug lets raw PII flow into the Analytics Warehouse.

**Recovery Strategy:** Contract tests on the redaction layer (RULE-054-equivalent for internal components) plus warehouse-side automated PII scanning as defense in depth.

**Scaling Strategy:** Analytics Warehouse ingestion is fully async/batched (RULE-098); never blocks the customer-facing path.

**Best Practice:** Treat PII redaction as a non-bypassable pipeline stage, not an opt-in library call.

**Trade Off:** An extra mandatory redaction hop adds ingestion latency, accepted because compliance (RULE-065) is non-negotiable.

---

## 10. Sequence Diagram

**Objective:** Detail one high-stakes sequence end-to-end: Campaign Optimization with budget guardrail.

```
Scheduler → CampaignAgent : trigger("evaluate_campaign")
CampaignAgent → ModelRouter : analyze(performance_data)
ModelRouter → LLMProvider : completion request
LLMProvider → ModelRouter : recommendation
ModelRouter → CampaignAgent : recommendation + confidence
CampaignAgent → GuardrailEngine : check(spend_increase, tenant_budget_ceiling)
GuardrailEngine → CampaignAgent : approved | rejected | needs_human_approval
alt approved
    CampaignAgent → ToolManager : AdjustBudgetTool(new_budget)
    ToolManager → AdsPlatform : update budget
    ToolManager → EventBus : publish campaign.budget_adjusted
else needs_human_approval
    CampaignAgent → EventBus : publish campaign.approval_requested
    EventBus → NotifyWorkflow : trigger dealer-admin notification
end
```

**Responsibilities:** Show that even an autonomous CampaignAgent's spend decision passes a Guardrail before any Tool executes (RULE-008, RULE-104).

**Components:** Scheduler, CampaignAgent, Model Router, LLM Provider, Guardrail Engine, Tool Manager, Ads Platform, Event Bus, Notify Workflow.

**Dependencies:** Guardrail Engine is consulted before, not after, the Tool call.

**Input:** Scheduled evaluation trigger + live campaign performance data.

**Output:** Either an executed budget adjustment or a human-approval request event.

**Sequence:** As diagrammed.

**Failure Scenario:** Guardrail Engine itself is unavailable.

**Recovery Strategy:** Fail-closed — if the Guardrail Engine cannot be reached, the spend action is NOT executed; it defaults to `needs_human_approval` (safety-first default, consistent with RULE-104's hard ceiling enforced outside the Agent).

**Scaling Strategy:** Guardrail Engine is a low-latency, highly-available synchronous dependency — deployed with redundancy ahead of Agent Runtime scale-up.

**Best Practice:** Every spend-capable Agent sequence includes an explicit Guardrail step in its documented sequence diagram before implementation begins.

**Trade Off:** Fail-closed guardrail behavior can delay legitimate optimizations during a Guardrail outage, accepted in exchange for eliminating runaway-spend risk.

---

## 11. Deployment Diagram

**Objective:** Show physical/cloud deployment topology.

```
                          ┌───────────────────────────────┐
                          │           Region: ap-southeast │
                          │  ┌───────────────────────────┐ │
                          │  │   Kubernetes Cluster        │ │
                          │  │  ┌─────────┐ ┌───────────┐ │ │
                          │  │  │API GW pod│ │Agent RT pod│ │ │
                          │  │  └─────────┘ └───────────┘ │ │
                          │  │  ┌─────────┐ ┌───────────┐ │ │
                          │  │  │Workflow  │ │Tool Mgr    │ │ │
                          │  │  │RT pod    │ │pod         │ │ │
                          │  │  └─────────┘ └───────────┘ │ │
                          │  └───────────────────────────┘ │
                          │  ┌───────────────────────────┐ │
                          │  │  Managed Postgres (per-tier)│ │
                          │  │  Managed Redis (cache/queue)│ │
                          │  │  Managed Vector DB           │ │
                          │  │  Managed Event Streaming     │ │
                          │  │  Object Storage (S3-compat)  │ │
                          │  └───────────────────────────┘ │
                          └───────────────────────────────┘
                                   │ (multi-region DR replica)
                                   ▼
                          ┌───────────────────────────────┐
                          │   Region: DR (standby)          │
                          └───────────────────────────────┘
```

**Responsibilities:** Map logical containers to physical/cloud infrastructure; establish region/DR topology.

**Components:** Kubernetes cluster (compute), managed data stores, object storage, DR region.

**Dependencies:** IaC-defined (RULE-086); no manual provisioning.

**Input:** Deployment manifests from CI/CD.

**Output:** Running, healthy, autoscaled services per environment.

**Sequence:** CI builds artifact → IaC applies/updates manifests → rolling/canary deploy → health checks gate traffic shift (RULE-087, RULE-088).

**Failure Scenario:** Primary region outage.

**Recovery Strategy:** DR region promoted per Disaster Recovery plan (§32); data stores replicated cross-region with defined RPO/RTO.

**Scaling Strategy:** Cluster autoscaler adds nodes based on pod scheduling pressure; each service group has its own HPA policy.

**Best Practice:** Keep stateless compute and durable state on separate scaling/failure domains.

**Trade Off:** Multi-region standby increases infra cost, accepted given SaaS uptime commitments to dealers running live customer-facing chat.

---

## 12. Multi-Tenant Architecture

**Objective:** Guarantee tenant isolation across every layer per Constitution §3.14 and RULE-016–020.

**Responsibilities:** Enforce data, compute-fairness, cost, and configuration isolation between dealer tenants.

**Components:** Tenant Context object (propagated everywhere), Row-Level Security (default tier), Database-per-tenant (Tier 1/Enterprise), per-tenant queue fairness, per-tenant Registry overrides, per-tenant cost meters.

**Dependencies:** Tenant Context must be resolvable at the Gateway from auth token before any downstream call (RULE-016, RULE-017).

**Input:** Authenticated request/event carrying `tenant_id`.

**Output:** All reads/writes/logs/events/costs scoped strictly to that `tenant_id`.

**Sequence:** Gateway resolves tenant → Tenant Context attached to request → propagated through every Agent/Workflow/Tool/Event/Queue/Log call.

**Failure Scenario:** A shared-tier tenant's row-level security policy is misconfigured, risking cross-tenant read.

**Recovery Strategy:** Automated isolation test suite (RULE-018, RULE-057) blocks release; RLS policy is centrally templated, not hand-written per table.

**Scaling Strategy:** Move a growing tenant from shared schema to dedicated database without changing application code (isolation strategy is a deployment/config concern, not a code concern).

**Best Practice:** Never trust application-layer tenant filtering alone — enforce at the storage layer (RULE-016).

**Trade Off:** Per-tenant isolation tooling (RLS policies, per-tenant queues) adds operational complexity versus a single shared table with app-level filters, but is non-negotiable at SaaS trust/compliance scale.

---

## 13. Plugin Architecture

**Objective:** Make every Agent, Tool, Workflow, and Channel Adapter independently installable per Constitution §3.1 and §8.

**Components:** Plugin Manifest (id, version, type, capabilities, permissions, dependencies, owner), Plugin Loader, Plugin Lifecycle Manager (install/enable/disable/uninstall), Plugin Sandbox/Contract Validator.

**Dependencies:** Plugin Loader depends on Registry Service to resolve manifests; Tool Manager depends on the Plugin's declared permissions to authorize calls (RULE-009).

**Input:** A plugin package + manifest submitted to the Registry.

**Output:** A runnable, permission-scoped capability available to tenants who enable it.

**Sequence:** Submit plugin → manifest validated → contract test run → quarantined if failing (RULE-112) → published as `draft` → promoted to `active` → tenants opt in.

**Failure Scenario:** A faulty Agent plugin throws on load, risking a core runtime crash.

**Recovery Strategy:** Plugin Loader runs load/contract checks in an isolated boundary; failing plugins are quarantined, not loaded (RULE-112), and the core runtime continues serving other plugins.

**Scaling Strategy:** New plugin types (e.g., a new Channel Adapter) extend the same manifest schema without core changes (Open/Closed).

**Best Practice:** Never let a plugin reach into another plugin's internal module (RULE from §8.4/Constitution).

**Trade Off:** Manifest/contract validation overhead per plugin publish, in exchange for a core runtime that never needs redeployment to add dealer-facing capability.

---

## 14. Registry Architecture

**Objective:** Provide the versioned source of truth for Prompts, Workflows, Tools, Agents, Models, and Policies (Constitution §9).

**Components:** Registry Service (API + storage), per-type Registries (Prompt/Workflow/Tool/Agent/Model/Policy), Versioning Engine (semver + immutability), Tenant Override Resolver, Registry Cache (edge, TTL-based), Publish Event Emitter.

**Dependencies:** Every Agent/Workflow/Tool resolves its configuration from here at runtime (RULE-002/003/004 in Constitution §27); no local hardcoded fallback is the source of truth.

**Input:** A new or updated Registry entry submitted by an authorized author (human or, for prompt tuning, an approved automated pipeline).

**Output:** A resolvable, versioned, tenant-override-aware configuration object.

**Sequence:** Author submits entry → validation → published as new immutable version → `registry.<type>.published` event emitted (RULE-013) → caches invalidated → consumers resolve new version per their pinning policy.

**Failure Scenario:** Registry Service is temporarily unavailable.

**Recovery Strategy:** Edge cache continues serving last-known-good versions with a bounded staleness window; Registry Service itself is deployed with redundancy as a Tier-0 dependency.

**Scaling Strategy:** Read-heavy — scale via cache layer and read replicas; writes are infrequent (human/pipeline-authored) and don't need write scaling.

**Best Practice:** Treat the Registry like a package manager: immutable versions, explicit deprecation, no in-place mutation (RULE-011).

**Trade Off:** Immutable versioning means storage grows over time (every prompt edit is a new version); accepted for full auditability and rollback capability.

**Why Registry (explicit rationale):** Without it, prompts/workflows/tool configs would be hardcoded per Constitution's explicit prohibition (RULE-003, RULE-004), making every tuning change require a code deploy — incompatible with thousands of tenants needing per-tenant tuning and rapid prompt iteration without redeploying the runtime.

**Why Registry as YAML/declarative format:** Declarative (YAML/JSON) definitions are diffable, reviewable in PRs, machine-validated against schema, and — critically — editable by non-engineers (prompt engineers, ops) without touching compiled code, while still being versioned like code.

---

## 15. Workflow Architecture

**Objective:** Orchestrate multi-step business processes declaratively and durably (Constitution §10).

**Components:** Workflow Definition (steps, transitions, retries, compensations — stored in Workflow Registry), Workflow Engine (interprets definitions), Durable Execution Store (event-sourced step state), Saga/Compensation Handler, Human-Checkpoint Gate.

**Dependencies:** Workflow Engine calls Agents/Tools via their respective Managers, never directly to external systems (RULE-004, RULE-028).

**Input:** A triggering event or scheduled tick naming a Workflow ID + version.

**Output:** A completed (or compensated/failed) workflow run, with full step-by-step audit trail.

**Sequence:** Trigger → Workflow Engine loads definition from Registry → executes steps in order, persisting state after each → on step failure, executes declared compensation → emits lifecycle events (RULE-032).

**Failure Scenario:** Process crash mid-way through a 5-step CampaignOptimizationWorkflow.

**Recovery Strategy:** Durable Execution Store lets any Workflow Engine instance resume from the last completed step using idempotency keys (RULE-029, RULE-030).

**Scaling Strategy:** Workflow Engine instances are stateless dispatchers; horizontal scaling is bound only by Durable Execution Store throughput.

**Best Practice:** Model every side-effecting step with an explicit compensation action, even if "no-op," so the saga contract is always complete.

**Trade Off:** Declarative workflow definitions are less flexible than free-form imperative code for edge cases, traded for resumability, auditability, and non-engineer readability.

**Why Workflow Runtime (explicit rationale):** Business processes here are long-running (multi-day nurturing), must survive crashes/restarts, must be pausable per-tenant (RULE-105), and must be auditable end-to-end for compliance — none of which a plain in-process function call chain can guarantee.

---

## 16. Event Driven Architecture

**Objective:** Provide the sole mechanism for cross-boundary, asynchronous communication (Constitution §3.2, §14).

**Components:** Event Bus (pub/sub broker), Event Schema Registry, Tolerant-Reader Consumer Contract, Trace Propagation, Dead-Letter routing (shared with Queue, §26).

**Dependencies:** Every Bounded Context publishes/subscribes only through here; no context polls another's database (RULE-023).

**Input:** A domain fact that has already occurred (e.g., `lead.scored`).

**Output:** Zero or more downstream reactions in other contexts (e.g., Sales Notify Workflow reacting to `lead.scored` where `hot=true`).

**Sequence:** Producer publishes event with schema version + trace_id → Event Bus persists/distributes → each subscribed consumer processes idempotently (dedup by event ID, RULE-037) → failures route to DLQ.

**Failure Scenario:** A new event schema version breaks an old consumer.

**Recovery Strategy:** Additive-only versioning within a major version + tolerant-reader consumers (RULE-035, RULE-036); breaking changes ship both versions during the deprecation window.

**Scaling Strategy:** Partition by `tenant_id` for ordering-where-needed while allowing massive horizontal consumer scale-out.

**Best Practice:** Name events as past-tense facts, never commands (RULE from Constitution §14.2).

**Trade Off:** Eventual consistency across contexts versus the simplicity of synchronous calls — accepted because it decouples deploy cadence and failure domains across Bounded Contexts.

**Why Event Bus (explicit rationale):** Direct agent-to-agent or module-to-module calls would create a tightly coupled dependency graph that cannot scale independently, cannot be replayed for audit, and violates RULE-002/RULE-023. The Event Bus makes every cross-boundary interaction observable, replayable, and independently scalable.

---

## 17. Tool Manager Architecture

**Objective:** Be the only sanctioned path from any Agent to any external system (Constitution §3.4, §12).

**Components:** Tool Registry lookup, Permission/Authorization Check, Schema Validator (input/output), Idempotency Key Manager, Circuit Breaker per Tool, Cost/Usage Meter, Tool Adapter implementations (one per external system).

**Dependencies:** Reads Tool definitions from the Tool Registry; enforces the calling Agent's declared permission set (RULE-009).

**Input:** A Tool invocation request from an Agent/Workflow step with typed parameters.

**Output:** A validated, schema-conformant result or a typed error.

**Sequence:** Agent requests Tool call → Tool Manager checks Agent's permission → validates input schema → checks side-effect classification (RULE-007) → routes to Adapter with idempotency key → validates output schema → meters cost → returns result, logging everything (RULE-012 Tool Standards).

**Failure Scenario:** The external Ads Platform API is down.

**Recovery Strategy:** Per-Tool circuit breaker trips, request fails fast with a typed `DependencyError`, Agent's Reflection Engine decides retry/escalate (RULE-049).

**Scaling Strategy:** Tool Manager is stateless and scales with call volume; per-Tool rate limiting protects shared external quotas across tenants.

**Best Practice:** Classify every Tool's side-effect (read-only/reversible/irreversible) at registration time, not as an afterthought (RULE-007).

**Trade Off:** Every external call incurs one extra hop (Agent → Tool Manager → Adapter) versus calling an SDK directly, traded for centralized security, observability, and guardrail enforcement.

**Why Tool Manager (explicit rationale):** Centralizing all external effects is what makes RULE-001 enforceable, makes permissioning and cost metering possible per-tenant, and lets the platform swap/upgrade an external integration (e.g., CRM provider) without touching any Agent code.

---

## 18. AI Runtime Architecture

**Objective:** Host the Agent execution loop: Planner → Executor → Reflection, backed by the Model Router and Memory Service (Constitution §11, §23).

**Components:** Planner (goal decomposition), Executor (step-by-step tool/sub-agent invocation), Reflection Engine (outcome evaluation, confidence scoring, retry/escalate decision), Guardrail Interceptor (pre-action policy check).

**Dependencies:** Planner/Reflection call the Model Router for LLM inference; Executor calls the Tool Manager; all three read/write via the Memory Service for context.

**Input:** A goal or task handed down from a Workflow step (e.g., "qualify this lead").

**Output:** A completed action set, an escalation, or a re-plan request.

**Sequence:** Task received → Planner drafts a plan (with Model Router) → Executor runs plan steps via Tool Manager → Reflection Engine scores the outcome/confidence → below-threshold confidence escalates (RULE-083); above-threshold completes.

**Failure Scenario:** Planner produces an infinite re-plan loop chasing an unreachable goal.

**Recovery Strategy:** Hard iteration ceiling and cost/time budget enforced by the Workflow step wrapping the Agent invocation (RULE-031); exceeding it force-escalates to human review.

**Scaling Strategy:** Each Agent invocation is a stateless unit of work dispatched from the Queue; scale by adding Agent Runtime workers.

**Best Practice:** Keep the Reflection Engine's confidence threshold configurable per Agent per tenant via the Policy Registry, not hardcoded.

**Trade Off:** The Plan→Execute→Reflect loop is slower per-task than a single-shot LLM call, traded for reliability, auditability, and controlled escalation.

**Why Planner (explicit rationale):** Automotive lead/campaign tasks are multi-step and context-dependent; a single-shot prompt cannot reliably decompose "find and nurture this lead" into safe, tool-scoped actions — an explicit Planner makes the decomposition inspectable and testable independent of any one LLM call.

**Why Reflection Engine (explicit rationale):** Without an explicit post-action evaluation step, low-confidence or erroneous autonomous actions (e.g., a mis-qualified Hot Lead) would reach Sales or spend budget unchecked; Reflection is what operationalizes RULE-083's escalation threshold.

---

## 19. Model Router Architecture

**Objective:** Decouple Agents from any specific LLM provider/model (Constitution §23, RULE-079–081).

**Components:** Routing Rule Engine (task-type → model-tier mapping, sourced from Model Registry), Fallback Chain Executor, Cost Meter (per tenant/agent/workflow), Provider Adapters (one per LLM provider).

**Dependencies:** Reads routing rules and pinned model versions from the Model Registry (RULE-073); every Agent calls this instead of an SDK directly.

**Input:** An inference request tagged with task type, tenant, and cost/latency requirements.

**Output:** A model completion plus metadata (model/version used, cost, latency, confidence signal if available).

**Sequence:** Agent requests inference → Router resolves model per Registry rule → primary Provider Adapter called → on failure/timeout, fallback chain invoked (RULE-080) → cost recorded → result returned with provenance metadata.

**Failure Scenario:** Primary LLM provider has a regional outage.

**Recovery Strategy:** Automatic failover to secondary provider in the declared chain, transparent to the Agent; alert fired for sustained primary outage.

**Scaling Strategy:** Connection pooling and per-provider rate-limit-aware queuing; router itself is stateless and horizontally scaled.

**Best Practice:** Never let an Agent hardcode a model name/provider (RULE-079); always resolve via Router + Registry.

**Trade Off:** An abstraction layer over LLM SDKs adds a small latency overhead, traded for provider-outage resilience, cost governance, and the ability to A/B test/upgrade models per tenant without code changes.

**Why Model Router (explicit rationale):** With BYO-key tenants, tiered cost plans, multiple providers for redundancy, and constant model version churn in the LLM market, hardcoding a provider per Agent would require a code change and redeploy for every model upgrade or provider outage — unacceptable at this system's operational tempo.

---

## 20. Memory Architecture

**Objective:** Give Agents durable, tenant-isolated context across Working, Episodic, and Semantic memory (Constitution §13).

**Components:** Working Memory Store (short-lived, session/task-scoped, e.g., Redis), Episodic Memory Store (conversation/interaction history, relational or document store), Semantic Memory Store (long-term facts/preferences, vector-indexed), Memory Access Gateway (enforces tenant scoping + retrieval logging).

**Dependencies:** All memory access goes through the Memory Access Gateway, never a direct store connection from an Agent (mirrors Tool Manager's mediation pattern).

**Input:** Read/write requests from Agents, tagged with tenant_id, entity_id (lead/conversation), and memory type.

**Output:** Retrieved context (with retrieval provenance logged per RULE-013.4-equivalent Memory Standards) or a write acknowledgment.

**Sequence:** Agent requests context → Gateway resolves tenant-scoped namespace → queries appropriate store (recency for Episodic, similarity for Semantic) → logs which memory IDs were retrieved → returns to Agent for prompt construction.

**Failure Scenario:** Semantic (vector) store is slow/unavailable, risking Agent timeout.

**Recovery Strategy:** Memory Access Gateway applies a timeout + degrades to Episodic-only context with a logged degradation flag, rather than failing the whole Agent turn.

**Scaling Strategy:** Working Memory scales via in-memory cache cluster; Episodic scales via standard DB read replicas; Semantic scales via vector DB sharding by tenant.

**Best Practice:** Tag and retention-policy every memory write by type at write time — never retroactively.

**Trade Off:** Three distinct memory stores (vs. one generic KV store) add operational surface area, traded for retrieval quality (semantic similarity) and compliance-friendly retention granularity (RULE-065).

**Why Shared Memory across an Agent's steps:** A single task (e.g., nurturing a lead over weeks) spans many separate Agent invocations; without shared, externalized memory, each invocation would start from zero context, making multi-touch nurturing impossible.

**Why Vector Memory specifically:** Long-term semantic recall ("this lead previously expressed interest in SUVs and financing") requires similarity search over unstructured history, which relational lookups cannot do efficiently at scale.

---

## 21. Knowledge Architecture

**Objective:** Provide Agents with static/slow-changing domain knowledge (vehicle catalogs, financing rules, dealer policies, compliance content) distinct from per-lead Memory.

**Components:** Knowledge Base (structured: catalog/pricing/policy data; unstructured: brochures/FAQs indexed for retrieval), Knowledge Ingestion Pipeline, Retrieval-Augmented-Generation (RAG) interface used by the Model Router/Planner.

**Dependencies:** Knowledge Base is tenant-scoped where dealer-specific (inventory, promotions) and global where industry-wide (general financing regulation templates).

**Input:** Dealer inventory feeds, policy documents, compliance updates.

**Output:** Retrieved knowledge snippets injected into Agent prompts with source citation for traceability.

**Sequence:** Source document/feed ingested → chunked/embedded → indexed → Agent's Planner requests relevant knowledge via RAG interface → snippets injected into context with provenance.

**Failure Scenario:** Stale inventory data causes the AI to promote a sold vehicle.

**Recovery Strategy:** Ingestion pipeline enforces max-staleness SLA per feed type; Content/Conversational Agents check a "last synced at" freshness flag before quoting inventory specifics.

**Scaling Strategy:** Ingestion is async/batched per tenant; retrieval is read-heavy and cached similarly to Semantic Memory.

**Best Practice:** Always attach source/version metadata to retrieved knowledge so outputs are auditable back to the source document.

**Trade Off:** Maintaining a separate Knowledge layer from Memory adds a store, traded for correctly separating "facts about the world/dealer" from "facts about this specific lead's interaction history."

---

## 22. Analytics Architecture

**Objective:** Provide funnel, attribution, cohort, and ROI insight per tenant, feeding both dashboards and Agent decision-making (e.g., CampaignAgent optimization).

**Components:** Event-sourced Analytics Warehouse (fed only via Event Bus, §9), Aggregation/Rollup Jobs (Scheduler-driven), Metrics Semantic Layer, Dashboard/Reporting API.

**Dependencies:** Warehouse ingestion is event-driven (RULE-023 compliant — never a direct DB read-replica of transactional PII stores).

**Input:** Domain events (`lead.*`, `campaign.*`, `conversation.*`, `content.*`).

**Output:** Tenant-scoped dashboards, scheduled reports, and features consumed by CampaignAgent's optimization decisions.

**Sequence:** Events published → Warehouse ingests → nightly/hourly rollup jobs (Scheduler) compute aggregates → Semantic Layer exposes named metrics → Dashboard API/CampaignAgent query them.

**Failure Scenario:** A rollup job fails silently, producing stale dashboards.

**Recovery Strategy:** Rollup jobs are Scheduler-managed with missed-run alerting (RULE-043); dashboards display a "data as of" freshness timestamp so staleness is visible, never silent.

**Scaling Strategy:** Warehouse is columnar/OLAP-oriented, scaled independently of the OLTP transactional stores.

**Best Practice:** Define metrics once in the Semantic Layer; never let dashboards and Agents compute the same metric with divergent logic.

**Trade Off:** Event-sourced warehouse ingestion has higher latency-to-freshness than direct DB queries, accepted to preserve Bounded Context isolation and PII safety.

---

## 23. Monitoring Architecture

**Objective:** Make system and business health observable in real time per tenant (Constitution §25).

**Components:** Metrics Collector (rate/error/latency/cost, tenant-tagged), SLO/Burn-Rate Alerting, Anomaly Detection (cost spikes, error spikes, unusual tenant behavior), Dashboards per Bounded Context and per tenant-tier.

**Dependencies:** Every service/Agent/Tool/Workflow instrumented uniformly via a shared Observability SDK.

**Input:** Runtime metrics emitted by every component.

**Output:** Dashboards, alerts, paged incidents.

**Sequence:** Component emits metric → Collector aggregates → SLO evaluator computes burn rate → threshold breach fires alert → on-call notified.

**Failure Scenario:** A silent regression in reply latency for one tenant tier goes unnoticed.

**Recovery Strategy:** Per-tier SLOs (RULE-094) with burn-rate alerting catch tier-specific regressions that a global-average metric would mask.

**Scaling Strategy:** Metrics pipeline is push-based and horizontally scalable, decoupled from the services it observes.

**Best Practice:** Alert on symptoms (SLO burn) rather than every possible cause metric, to avoid alert fatigue.

**Trade Off:** Fine-grained per-tenant monitoring costs more storage/compute than aggregate-only monitoring, justified by the need to catch single-tenant-impacting incidents at thousands-of-tenants scale.

---

## 24. Logging Architecture

**Objective:** Provide structured, redacted, traceable logs sufficient to reconstruct any AI decision (Constitution §17).

**Components:** Structured Logger SDK (shared across all services), PII Redaction Middleware, Centralized Log Store (tenant-filterable), Retention Policy Engine.

**Dependencies:** Every log line includes `tenant_id`, `trace_id`, emitting component ID (RULE-045).

**Input:** Log calls from every service/Agent/Tool/Workflow.

**Output:** Queryable, tenant-scoped, retention-compliant log records.

**Sequence:** Log call → Redaction Middleware scrubs known-sensitive fields → shipped to Centralized Log Store → retained per policy → queryable by trace_id for incident/decision reconstruction.

**Failure Scenario:** An engineer needs to log a new field that happens to contain PII, unaware of the redaction requirement.

**Recovery Strategy:** Redaction Middleware operates on a denylist/tagged-field basis enforced centrally, not per call site, so new fields are caught by policy rather than developer discipline alone.

**Scaling Strategy:** Log ingestion scales via the log store's native sharding; retention tiers (hot/cold) control long-term cost.

**Best Practice:** Every AI decision log must be sufficient to answer "why did the AI do this" without replaying the LLM call (RULE-047).

**Trade Off:** Structured logging with mandatory fields adds minor per-call overhead versus free-text logging, traded for queryability and compliance.

---

## 25. Security Architecture

**Objective:** Enforce isolation, least-privilege, and data protection across the platform (Constitution §20).

**Components:** Identity & Access layer (RBAC, per-tenant and per-role), Secrets Manager, Encryption-in-Transit/At-Rest, Webhook Signature Verification, Prompt-Injection Defense Layer (input sanitization, output validation, tool-call allowlisting), Vulnerability Scanning in CI, Audit Log for internal access.

**Dependencies:** Every API endpoint enforces RBAC (RULE-062); every Tool credential resolves from the Secrets Manager at call time (RULE-060).

**Input:** Every authenticated request, every webhook, every LLM input/output.

**Output:** Authorized actions only; denied/flagged actions on violation.

**Sequence:** Request arrives → signature/auth verified → RBAC check → (if LLM-involved) prompt-injection defense applied to input and output → action proceeds or is denied/escalated.

**Failure Scenario:** A crafted lead message attempts prompt injection to make the Conversational Agent reveal internal instructions or call an unauthorized Tool.

**Recovery Strategy:** Input sanitization + Tool-call allowlisting (only declared Tools per RULE-009 are callable regardless of what the LLM "decides") + output validation before the reply is sent.

**Scaling Strategy:** Security checks are stateless middleware, scaling linearly with request volume.

**Best Practice:** Treat every LLM input and output as untrusted, symmetric with how untrusted user input is treated (RULE-064).

**Trade Off:** Defense-in-depth layers (sanitization + allowlisting + output validation) add latency per request, non-negotiable given autonomous customer-facing and spend-capable actions.

---

## 26. Queue Architecture

**Objective:** Durable, fair, tenant-aware async job dispatch (Constitution §15).

**Components:** Durable Queue Broker, Per-Tenant Fair Scheduler, Dead-Letter Queue (DLQ), Retry/Backoff Policy Engine, Poison-Message Quarantine.

**Dependencies:** Every queued job carries tenant context, idempotency key, max-retry count, DLQ destination (RULE-038).

**Input:** Jobs dispatched from Workflow steps, Tool retries, or Scheduler ticks.

**Output:** Executed jobs or DLQ-routed failures with alerting.

**Sequence:** Job enqueued → fair scheduler ensures no tenant starves others (RULE-019) → consumer picks up → success or retry-with-backoff → exhausted retries route to DLQ → alert fired, operator can inspect/replay (RULE-039).

**Failure Scenario:** A single large tenant's bulk campaign job floods the queue, delaying other tenants' time-sensitive follow-ups.

**Recovery Strategy:** Per-tenant fair-share/rate-limited consumption prevents one tenant's volume from starving others.

**Scaling Strategy:** Consumers are stateless and horizontally scaled by queue depth per partition/tenant-group.

**Best Practice:** Auto-quarantine poison messages after N retries rather than looping forever and blocking the queue (RULE-040).

**Trade Off:** Per-tenant fairness logic is more complex than FIFO, required to meet multi-tenant SLA commitments.

**Why Queue (explicit rationale):** Nearly all AOS work (tool execution, notifications, workflow steps) is asynchronous by design (Async First, §3.7); a durable queue is what makes that async work reliable, retryable, and fair across tenants instead of best-effort in-process fire-and-forget.

---

## 27. Scheduler Architecture

**Objective:** Drive all time-based/recurring triggers from a Registry-defined source of truth (Constitution §16).

**Components:** Scheduler Registry (job definitions), Scheduler Engine (tick evaluation, at-least-once triggering), Tenant Timezone/Business-Hours Resolver, Missed-Run Alerting.

**Dependencies:** Scheduled jobs are declared in the Scheduler Registry, not ad-hoc cron (RULE-041).

**Input:** Time triggers and Registry-defined schedules.

**Output:** Triggered Workflow/Agent invocations, idempotently handled downstream.

**Sequence:** Scheduler tick evaluated → tenant timezone/business-hours check applied where relevant (RULE-042) → job dispatched to Queue → downstream idempotent handling ensures at-least-once semantics are safe.

**Failure Scenario:** Scheduler is down during a scheduled tick window (e.g., nightly campaign evaluation).

**Recovery Strategy:** Catch-up-on-recovery by default (missed tick is executed once Scheduler resumes) unless a job is explicitly configured skip-if-missed (RULE-044).

**Scaling Strategy:** Scheduler Engine is horizontally scaled with distributed-lock-based tick ownership to avoid duplicate triggering.

**Best Practice:** Every scheduled job must be individually pausable per tenant (RULE-044) — a tenant pausing their campaigns must not affect others.

**Trade Off:** A centralized Scheduler Registry is an extra indirection versus per-service cron, required to give tenant admins (RULE-105) and operators a single place to see/pause all time-based automation.

**Why Scheduler (explicit rationale):** Ad-hoc cron scattered across services is invisible to tenant admins wanting to pause their automation and to operators debugging "why did this fire," and cannot respect per-tenant timezone/business-hours — a centralized, Registry-driven Scheduler solves both.

---

## 28. API Gateway Architecture

**Objective:** Be the single authenticated, tenant-resolving, rate-limited entry point for all synchronous traffic and inbound webhooks.

**Components:** Auth/Token Verification, Tenant Resolver, Rate Limiter (per-tenant, per-API-key), Request Schema Validator, Webhook Signature Verifier, Routing Layer to internal containers.

**Dependencies:** Downstream services trust the Gateway to have already authenticated and tenant-scoped the request; they still re-validate schema (defense in depth) but do not re-implement auth.

**Input:** All external HTTP/webhook traffic.

**Output:** Authenticated, tenant-scoped, validated requests forwarded internally; rejected/rate-limited responses for violations.

**Sequence:** Request arrives → signature/token verified → tenant resolved → rate limit checked → schema validated → routed to Agent Runtime/Workflow Runtime/internal API.

**Failure Scenario:** A compromised API key is used for high-volume abuse.

**Recovery Strategy:** Per-key rate limiting and anomaly detection (RULE-068, RULE-069) throttle/block before impact spreads to other tenants.

**Scaling Strategy:** Stateless, horizontally scaled, typically the first layer to autoscale under traffic spikes.

**Best Practice:** Never let an internal service accept unauthenticated/untenant-scoped traffic even if "only the Gateway calls it" — verify at every hop.

**Trade Off:** Centralizing auth/rate-limiting/tenant-resolution at the Gateway creates a critical-path dependency, mitigated by making the Gateway itself the most redundantly deployed container.

---

## 29. Integration Architecture

**Objective:** Standardize how AOS connects to external CRM, Ads, Messaging, Payment, and future systems.

**Components:** Tool Adapter per integration (Constitution §17), Integration Manifest (credentials, rate limits, failure modes — RULE-114), Sandbox/Test-mode support per integration, Webhook Ingestion normalizers (per-channel payload → canonical internal event).

**Dependencies:** Every integration is a Tool, resolved via the Tool Registry, never a bespoke direct client embedded in an Agent.

**Input:** Outbound calls (send message, sync CRM record) and inbound webhooks (customer reply, ad platform callback).

**Output:** Normalized internal events/results regardless of source channel/provider.

**Sequence:** New integration proposed → Adapter built against the Port interface → Integration Manifest documents credentials/limits/failure modes (RULE-114) → contract-tested (RULE-054) → published to Tool Registry → enabled per tenant.

**Failure Scenario:** A messaging provider changes their API contract without notice.

**Recovery Strategy:** Scheduled contract tests (RULE-054) catch drift in CI before it reaches production traffic; circuit breaker limits blast radius if it slips through.

**Scaling Strategy:** Each integration Adapter scales independently and can be rate-limited independently of others sharing the same external provider's global quota.

**Best Practice:** Normalize inbound channel payloads to a canonical internal shape immediately at the edge, so downstream Agents never branch on "which channel did this come from."

**Trade Off:** Building a normalization layer per channel is more upfront work than passing raw payloads through, traded for Agent logic that is channel-agnostic and easy to extend to new channels.

---

## 30. Simulation Architecture

**Objective:** Allow safe, offline evaluation of Agents/Workflows/prompt or model changes against realistic scenarios before touching live tenants.

**Components:** Simulation Engine (replays historical/synthetic scenarios through the Agent/Workflow Runtime in an isolated sandbox), Synthetic Lead/Conversation Generator, Scenario Library (regression scenarios per Agent, feeding RULE-055 prompt-regression tests), Outcome Scorer (compares simulated decisions against expected/historical outcomes).

**Dependencies:** Simulation Engine uses the same Agent Runtime/Workflow Runtime code paths as production, with Tool Manager calls routed to mocked/sandboxed Adapters — never live external systems.

**Input:** A candidate Agent/Prompt/Model/Workflow version + a scenario set.

**Output:** A scorecard (accuracy, cost, latency, guardrail-trigger rate) gating promotion from `draft` to `active` in the Registry.

**Sequence:** New version proposed → Simulation Engine runs it against the Scenario Library in sandbox → Outcome Scorer compares to baseline → pass/fail gates promotion; failures block Registry publish to `active`.

**Failure Scenario:** A new prompt version passes simulation but behaves differently under live traffic distribution shift.

**Recovery Strategy:** Canary release (RULE-085, RULE-090) to a small tenant subset in production as a second gate after simulation, not a replacement for it.

**Scaling Strategy:** Simulation runs are batch/async and can be parallelized across the Scenario Library without touching production capacity.

**Best Practice:** Every Agent must have a non-empty Scenario Library before its first production enablement.

**Trade Off:** Building and maintaining a Simulation Engine + Scenario Library is significant upfront investment, justified because live A/B testing of autonomous, spend-capable, customer-facing AI decisions is too risky as the _first_ gate.

**Why Simulation Engine (explicit rationale):** Autonomous agents making spend and customer-communication decisions cannot be safely validated by "ship it and watch" alone; a simulation gate operationalizes RULE-055 (prompt-regression testing) and RULE-090 (canary rollout) into a concrete, reusable pre-production system.

---

## 31. Scalability Architecture

**Objective:** Meet the "thousands of dealers, concurrently" target (Constitution §26.3).

**Components:** Horizontal Pod Autoscaling per container, tenant-sharded data stores, partitioned Event Bus/Queue by tenant, read replicas for Analytics, edge caching for Registry reads.

**Dependencies:** Every stateless container scales independently; every stateful store scales via its own sharding/replication strategy.

**Input:** Load metrics (request rate, queue depth, CPU/memory) per container.

**Output:** Dynamically adjusted capacity meeting per-tier SLOs (§23) without manual intervention.

**Sequence:** Load increases → autoscaler adds instances per policy → load balancer/queue distributes work → sustained growth triggers data-store resharding runbook (semi-automated, reviewed).

**Failure Scenario:** A single large "whale" tenant's traffic pattern threatens to dominate shared infrastructure.

**Recovery Strategy:** Per-tenant fair-share (Queue §26) and per-tenant rate limiting (Gateway §28) cap any one tenant's consumption of shared capacity; whale tenants are migrated to dedicated infra tier as needed.

**Scaling Strategy:** Load-tested against the stated multi-tenant scale target before any major capability is declared production-ready (RULE-100).

**Best Practice:** Design every new component's scaling story (stateless vs. stateful, sharding key) at design time, not after a production incident.

**Trade Off:** Designing for thousands-of-tenants scale from day one costs more upfront engineering than a single-tenant MVP, accepted because retrofitting multi-tenancy later is far more expensive than building it in from the start.

---

## 32. Disaster Recovery

**Objective:** Define RPO/RTO and recovery procedures for platform-wide and regional failure.

**Components:** Cross-region data replication, automated backup/restore pipelines, DR runbooks, regular DR drills, Incident Command process.

**Dependencies:** DR depends on IaC (RULE-086) to rebuild infrastructure deterministically in a standby region.

**Input:** A declared disaster (regional outage, data corruption, catastrophic bug).

**Output:** Restored service within target RTO, data loss bounded by target RPO.

**Sequence:** Incident declared → Incident Command activated → DR runbook executed (promote standby region / restore from backup) → health verified → traffic shifted → post-incident review produces an ADR if architecture changes are needed.

**Failure Scenario:** Primary region's managed Postgres becomes unavailable.

**Recovery Strategy:** Promote cross-region replica per documented RPO (target: minutes of data loss) and RTO (target: under an hour for Tier-1 tenants); DR drills run on a fixed cadence to validate the runbook actually works, not just exists on paper.

**Scaling Strategy:** DR capacity is provisioned proportionally to primary, adjusted as tenant count grows.

**Best Practice:** Never let a DR runbook go untested — a plan that has never been drilled is a hypothesis, not a capability.

**Trade Off:** Maintaining warm standby infrastructure costs continuously, accepted given the platform runs live customer-facing communication and cannot tolerate extended outages.

---

## 33. Cost Optimization

**Objective:** Keep infrastructure and AI inference cost predictable and attributable per tenant (Constitution §1.10, §23.3).

**Components:** Per-tenant/per-agent/per-workflow cost meters (Model Router §19, Tool Manager §17), Cost Anomaly Detection (Monitoring §23), Tiered Model Routing (cheaper models for low-stakes tasks, premium models reserved for high-stakes decisions), Autoscaling policies tuned to avoid over-provisioning idle capacity.

**Dependencies:** Cost metering is built into the Model Router and Tool Manager themselves, not a separate after-the-fact billing reconciliation.

**Input:** Every LLM call and Tool call, tagged with tenant/agent/workflow.

**Output:** Real-time cost dashboards per tenant; automated alerts on cost-per-tenant anomalies; usage-based billing inputs.

**Sequence:** Call made → cost recorded at source → aggregated per tenant/agent/workflow → compared against configured budget ceilings (RULE-104, RULE-113) → alert or hard-stop on breach.

**Failure Scenario:** A misconfigured Agent loop calls an expensive premium model far more often than intended, spiking cost for one tenant.

**Recovery Strategy:** Hard cost ceilings enforced outside the Agent (at Model Router/Tool Manager level, RULE-104's pattern applied generally) auto-halt further calls once breached, independent of the Agent's own logic being correct.

**Scaling Strategy:** Route routine/low-stakes tasks (e.g., simple FAQ replies) to cheaper/faster models, reserving premium models for high-stakes reasoning (lead qualification, campaign strategy) via Model Registry routing rules.

**Best Practice:** Configure cost ceilings before enabling a new Agent/Workflow in production, never retroactively after an incident (RULE-113).

**Trade Off:** Fine-grained per-call cost metering adds a small amount of overhead per call, essential for usage-based billing and preventing runaway spend in an autonomous system.

---

## 34. Future Extension

**Objective:** Ensure the architecture accommodates known future directions without core rework.

**Anticipated extensions and how the current design already accommodates them:**

- **New product modules** (e.g., Finance & Insurance upsell, Service/Aftersales nurturing) → new Bounded Contexts + new Agents/Workflows, zero core runtime change (§2, §13).
- **New channels** (new messaging platforms, voice) → new Tool Adapters + Integration Manifests, zero Agent-logic change (§29).
- **New LLM providers/models** → new Provider Adapter behind Model Router, zero Agent-logic change (§19).
- **New compliance regimes per region** → Policy/Guardrail Registry entries scoped by tenant region, zero core change (§9, §25).
- **New tenant tiers/pricing models** → Multi-Tenant Architecture's isolation strategy is a deployment/config concern already designed to flex per tier (§12).
- **Agent self-improvement / auto-prompt-tuning pipelines** → routed through the same Simulation Engine gate (§30) before any promotion to `active`, preserving safety guarantees even for automated proposers.

**Failure Scenario:** A future requirement appears to need bypassing a core boundary (e.g., "let this Agent call the CRM API directly for speed").

**Recovery Strategy:** Constitution Conflict Protocol (§0.2) applies — surface the conflicting RULE (here, RULE-001), propose a compliant alternative (e.g., a faster, purpose-built Tool), and require explicit ADR-recorded exception before any deviation.

**Best Practice:** Every future extension proposal is evaluated first against "which existing pillar does this extend" before considering "does this need a new pillar."

**Trade Off:** Disciplined extension-through-existing-pillars is slower for one-off asks than "just wire it up directly," but is what keeps the core runtime boring and stable (§1.2) as the platform scales to thousands of tenants and many more product modules.

---

## 35. Architecture Decision Records (ADR)

### ADR-001 — Use an Event Bus for Cross-Context Communication

**Status:** Accepted
**Context:** Bounded Contexts (Lead, Campaign, Content, Conversation, Analytics) must react to each other's facts without tight coupling or shared databases (Constitution §3.8, §3.2).
**Decision:** All cross-context communication is via published, versioned events on a central Event Bus.
**Consequences:** Decoupled deploy cadence and failure domains; eventual consistency must be tolerated by consumers.
**Alternatives Considered:** Direct synchronous service-to-service calls (rejected: tight coupling, cascading failure risk); shared database (rejected: violates RULE-023, Bounded Context ownership).

### ADR-002 — Agents Never Call External APIs Directly

**Status:** Accepted
**Context:** Uncontrolled external calls make permissioning, cost tracking, and guardrail enforcement impossible (RULE-001).
**Decision:** All external effects go through the Tool Manager.
**Consequences:** Extra hop per external call; centralized security/cost/observability.
**Alternatives Considered:** Per-Agent SDK clients (rejected: no central enforcement point, RULE-001 violation).

### ADR-003 — Registries as the Sole Source of Prompts/Workflows/Tools/Models

**Status:** Accepted
**Context:** Hardcoded prompts/workflows require a redeploy for every tuning change, incompatible with per-tenant customization at scale (RULE-003, RULE-004).
**Decision:** All such configuration is versioned Registry entries resolved at runtime.
**Consequences:** Requires a Registry Service and edge caching; enables non-engineer-driven tuning and instant rollback.
**Alternatives Considered:** Config files bundled at build time (rejected: requires redeploy per change, no per-tenant override).

### ADR-004 — Domain-Driven Bounded Contexts as the Primary Decomposition Axis

**Status:** Accepted
**Context:** The product spans many business capabilities (lead, campaign, content, conversation, analytics, CRM, billing) that must evolve independently.
**Decision:** Decompose the system by Bounded Context, each owning its data and exposing only events/APIs.
**Consequences:** Requires context maps and anti-corruption layers at boundaries; prevents "big ball of mud" coupling as the product grows.
**Alternatives Considered:** Technical-layer decomposition only (e.g., one big "backend" service) (rejected: does not scale team/ownership boundaries).

### ADR-005 — Hexagonal (Ports & Adapters) for All External Dependencies

**Status:** Accepted
**Context:** LLM providers, messaging platforms, CRMs, and payment gateways all change frequently and must be swappable (RULE-025).
**Decision:** Every external dependency is accessed through a Port interface with one or more Adapters.
**Consequences:** More interfaces/boilerplate; full swappability without touching domain/application logic.
**Alternatives Considered:** Direct SDK usage throughout (rejected: vendor lock-in, untestable domain logic).

### ADR-006 — Plugin Architecture for Agents/Tools/Workflows/Channels

**Status:** Accepted
**Context:** New dealer-facing capability must ship without redeploying or destabilizing the core runtime (§3.1).
**Decision:** Agents, Tools, Workflows, and Channel Adapters are manifest-declared, independently installable plugins.
**Consequences:** Requires a Plugin Loader/Lifecycle Manager and contract validation; enables per-tenant opt-in and safe rollback.
**Alternatives Considered:** Monolithic build with feature flags only (rejected: still requires full redeploy per change, higher blast radius).

### ADR-007 — Workflow Engine for Multi-Step, Durable Business Processes

**Status:** Accepted
**Context:** Nurturing sequences and campaign processes run over days/weeks and must survive crashes (§10).
**Decision:** Business processes are declarative Workflow definitions executed by a durable Workflow Engine with event-sourced state.
**Consequences:** Less flexible than free-form imperative code; gains resumability, auditability, and non-engineer readability.
**Alternatives Considered:** Cron + imperative service code chains (rejected: not resumable, not auditable end-to-end).

### ADR-008 — Model Router to Decouple Agents from LLM Providers

**Status:** Accepted
**Context:** Multiple LLM providers, tiered cost plans, and BYO-key tenants require dynamic model selection (§23).
**Decision:** All inference calls go through a Model Router resolving provider/model from the Model Registry, with declared fallback chains.
**Consequences:** Small latency overhead; provider-outage resilience and per-tenant cost governance.
**Alternatives Considered:** Hardcoded single-provider integration (rejected: no failover, no per-tenant flexibility).

### ADR-009 — Three-Tier Memory Model (Working / Episodic / Semantic)

**Status:** Accepted
**Context:** Agents need different retention/retrieval characteristics for session state, conversation history, and long-term facts (§13, §20).
**Decision:** Separate stores per memory tier, all accessed via a mediating Memory Access Gateway.
**Consequences:** More operational surface than one generic store; better retrieval quality and retention granularity.
**Alternatives Considered:** Single generic key-value store for all memory (rejected: poor semantic retrieval, coarse retention control).

### ADR-010 — Guardrail/Policy Engine as a Mandatory Pre-Action Gate

**Status:** Accepted
**Context:** Autonomous, spend-capable, customer-facing actions carry real business/compliance risk (§11.7, RULE-008).
**Decision:** Every irreversible or costly Agent action passes a synchronous Guardrail check before execution, fail-closed on Guardrail unavailability.
**Consequences:** Adds a hard dependency and latency on the action path; eliminates a whole class of runaway-autonomy risk.
**Alternatives Considered:** Post-hoc auditing only (rejected: damage already done by the time it's detected).

### ADR-011 — Per-Tenant Fair-Share Queueing

**Status:** Accepted
**Context:** Shared infrastructure must not let one tenant's volume starve others (RULE-019).
**Decision:** Queue consumption is fair-share/rate-limited per tenant, not simple FIFO.
**Consequences:** More complex scheduling logic; predictable SLAs across all tenants regardless of a "whale" tenant's load.
**Alternatives Considered:** Plain FIFO queue (rejected: noisy-neighbor risk at multi-tenant scale).

### ADR-012 — Row-Level Security as Default Tenant Isolation, Database-per-Tenant for Enterprise Tier

**Status:** Accepted
**Context:** Thousands of tenants at varying trust/compliance tiers need isolation cost-effectively (§12, RULE-016).
**Decision:** Default to RLS on shared schemas; provision dedicated databases for Tier-1/Enterprise or data-residency-constrained tenants.
**Consequences:** Two isolation strategies to maintain; cost-effective default with a compliant escape hatch for demanding tenants.
**Alternatives Considered:** Database-per-tenant universally (rejected: operationally expensive at thousands-of-tenants scale for the default tier).

### ADR-013 — Simulation Engine as a Mandatory Pre-Production Gate for Agents

**Status:** Accepted
**Context:** Live A/B testing of autonomous, spend-capable AI decisions is too risky as the first validation gate (§30).
**Decision:** New/changed Agent, prompt, or model versions must pass Simulation Engine scenarios before Registry promotion to `active`.
**Consequences:** Requires maintaining a Scenario Library per Agent; catches regressions before any live tenant is affected.
**Alternatives Considered:** Canary release as the only gate (rejected as sole gate: still exposes real tenants/leads to unvalidated behavior, though retained as a second gate per ADR-014).

### ADR-014 — Canary/Tenant-Subset Rollout for New Plugin Versions

**Status:** Accepted
**Context:** Even simulation-validated changes can behave differently under live traffic distribution shift (§30, RULE-090).
**Decision:** New Agent/Tool/Workflow versions roll out to a canary tenant subset before global availability.
**Consequences:** Slower global rollout; catches simulation-blind-spot regressions with bounded blast radius.
**Alternatives Considered:** Immediate global rollout post-simulation (rejected: unbounded blast radius on regression).

### ADR-015 — Structured, Redacted Logging as a Non-Bypassable Middleware

**Status:** Accepted
**Context:** PII must never reach plaintext logs (RULE-046), and AI decisions must be reconstructable (RULE-047).
**Decision:** All logging goes through a shared SDK with mandatory redaction middleware and required structured fields.
**Consequences:** Minor per-call overhead; consistent compliance posture without relying on per-developer discipline.
**Alternatives Considered:** Convention-based logging with developer-applied redaction (rejected: inconsistent, error-prone at scale).

### ADR-016 — Fail-Closed Guardrail Behavior on Guardrail Engine Unavailability

**Status:** Accepted
**Context:** A spend/customer-impacting action must never execute "by default" if its safety check cannot be evaluated (§10 sequence example).
**Decision:** If the Guardrail Engine is unreachable, the default action is `needs_human_approval`, never silent execution.
**Consequences:** Some legitimate optimizations are delayed during a Guardrail outage; runaway-risk actions are categorically prevented.
**Alternatives Considered:** Fail-open with post-hoc audit (rejected: unacceptable risk for spend/compliance-sensitive actions).

### ADR-017 — Analytics Warehouse Fed Exclusively via Events

**Status:** Accepted
**Context:** Direct read-replicas of transactional PII stores would violate Bounded Context isolation and complicate PII compliance (§9, §22).
**Decision:** The Analytics Warehouse ingests only from the Event Bus.
**Consequences:** Slightly higher latency-to-freshness for dashboards; preserved context isolation and PII safety by construction.
**Alternatives Considered:** Direct DB read-replica into the warehouse (rejected: leaks internal schema coupling and PII risk across context boundaries).

### ADR-018 — Cost Ceilings Enforced Outside the Agent, Not Trusted to Agent Logic

**Status:** Accepted
**Context:** An Agent's own internal logic can be wrong or exploited; spend/cost limits must hold regardless (RULE-104, RULE-113).
**Decision:** Hard cost/spend ceilings are enforced at the Model Router/Tool Manager layer, external to any Agent's own decision-making.
**Consequences:** Requires ceiling configuration before any new Agent/Workflow is enabled; eliminates single-point-of-failure risk in Agent logic for cost control.
**Alternatives Considered:** Trusting each Agent to self-limit its spend (rejected: a single Agent bug could cause unbounded cost).

### ADR-019 — Declarative YAML/JSON Registries over Code-Embedded Configuration

**Status:** Accepted
**Context:** Prompts/workflows must be editable, reviewable, and versionable by both engineers and non-engineers without a core redeploy (§14).
**Decision:** Registries store declarative, schema-validated definitions (YAML/JSON), never code-embedded configuration.
**Consequences:** Requires schema validation tooling; enables PR-reviewable, diffable, non-engineer-editable configuration.
**Alternatives Considered:** Configuration as code (embedded in the same repo/language as the runtime) (rejected: couples config changes to code deploys, raises the bar for non-engineer contribution).

### ADR-020 — Multi-Region Standby for Disaster Recovery

**Status:** Accepted
**Context:** The platform runs live, autonomous customer-facing communication and cannot tolerate extended regional outages (§32).
**Decision:** Maintain a warm standby region with cross-region data replication and drilled runbooks.
**Consequences:** Continuous additional infrastructure cost; bounded RPO/RTO for Tier-1 tenant commitments.
**Alternatives Considered:** Single-region with backup-restore-only DR (rejected: RTO too long for live customer-facing SLAs).

---

## 36. Dependency Graph

```
                     Dashboard (Web App)
                            │
                            ▼
                      API Gateway
                            │
                            ▼
                      Agent Runtime
                     ┌──────┴──────┐
                     ▼             ▼
                  Planner      Reflection Engine
                     │             │
                     ▼             ▼
                Workflow Runtime ◄─┘
                     │
        ┌────────────┼─────────────┐
        ▼            ▼             ▼
   Tool Manager   Event Bus      Queue ──▶ Scheduler
        │            │
        ▼            ▼
  External APIs   Downstream Workflows / Notify

  (Consulted by Agent Runtime, Workflow Runtime, and Tool Manager
   at every step — not a linear stage, but a set of always-available services)
        Registries ── Model Router ── Memory Service ── Guardrail Engine
                              │
                              ▼
                        LLM Providers
```

This graph is the authoritative build/test order reference: core cross-cutting services (Registries, Model Router, Memory Service, Guardrail Engine, Event Bus, Queue) must be stood up and contract-tested before any Agent/Workflow/Tool plugin can be implemented against them.

---

## 37. Folder Structure

```
docs/                          # Constitution, this Blueprint, ADRs, subsequent design docs
apps/
  dashboard/                   # Dealer Admin web app
  sales-console/                # Sales staff Hot Lead console
packages/
  ui-components/                # Shared frontend component library
core/
  runtime/
    agent-runtime/              # Planner, Executor, Reflection Engine
    workflow-runtime/           # Workflow Engine, Durable Execution Store
    tool-manager/               # Permission check, schema validation, adapters registry
    model-router/               # Routing rules, fallback chain, provider adapters
    memory-service/             # Working / Episodic / Semantic stores + gateway
    event-bus/                  # Pub/sub broker client, schema registry client
    queue/                      # Queue client, fair-scheduler, DLQ handling
    scheduler/                  # Scheduler engine, tenant timezone resolver
    guardrail-engine/           # Policy evaluation service
  registry/
    prompt-registry/
    workflow-registry/
    tool-registry/
    agent-registry/
    model-registry/
    policy-registry/
  gateway/                      # API Gateway (auth, tenant resolution, rate limit)
agents/                         # Agent plugins (one folder per Agent, manifest + logic)
tools/                          # Tool plugins (one folder per Tool, manifest + adapter)
workflows/                      # Workflow definitions (declarative, per Workflow)
simulation/
  scenario-library/
  simulation-engine/
integrations/                   # Integration manifests + channel normalizers
shared/
  logging/
  tracing/
  error-types/
  validation/
  observability-sdk/
infra/
  iac/                          # Infrastructure as Code (cluster, data stores, networking)
  ci-cd/                        # Pipeline definitions
tests/
  contract/
  integration/
  chaos/
  isolation/                    # Multi-tenant isolation test suite
```

This structure mirrors §7 of the Constitution and the container map in §5.2 above; no additional top-level folders should be introduced without updating both this Blueprint and the Constitution's Folder Structure Standards.

---

## 38. Tech Stack Recommendation

| Layer                       | Recommendation                                                                                                                  | Rationale                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Backend**                 | TypeScript (Node.js) or Python for Agent/Workflow/Tool runtimes                                                                 | Strong async ecosystem, first-class LLM SDK support, large talent pool for a fast-growing SaaS    |
| **Frontend**                | React + TypeScript SPA                                                                                                          | Matches component-based UI needs of Dashboard/Sales Console; wide ecosystem                       |
| **Primary Database**        | PostgreSQL (managed, e.g., RDS/Cloud SQL) with Row-Level Security                                                               | Strong RLS support for multi-tenant isolation (§12); mature, well-understood operationally        |
| **Vector Database**         | Managed vector store (e.g., pgvector on Postgres for simpler tiers, dedicated vector DB for Semantic Memory/Knowledge at scale) | Needed for Semantic Memory (§20) and Knowledge RAG (§21) similarity search                        |
| **Cache / Working Memory**  | Redis (managed)                                                                                                                 | Sub-millisecond working memory and rate-limit counters; widely supported                          |
| **Queue**                   | Managed durable queue (e.g., SQS-equivalent) or Redis Streams for lower tiers                                                   | Needs DLQ, per-tenant fairness, at-least-once delivery (§26)                                      |
| **Event Bus**               | Managed event streaming platform (e.g., Kafka-compatible or cloud-native pub/sub) with schema registry                          | Needs partitioning by tenant, replayability, schema evolution support (§16)                       |
| **Object Storage**          | S3-compatible object storage                                                                                                    | Content assets, backups, knowledge documents                                                      |
| **Container Orchestration** | Kubernetes (managed, e.g., EKS/GKE)                                                                                             | Cloud-native, autoscaling, multi-region capable (§11, §31)                                        |
| **CI/CD**                   | Git-based pipeline (e.g., GitHub Actions/GitLab CI) with IaC-driven deploy                                                      | Enforces RULE-086/RULE-091 (traceable, automated deployment)                                      |
| **Infrastructure as Code**  | Terraform (or cloud-native equivalent)                                                                                          | Deterministic, reviewable infra changes; required for DR rebuild (§32)                            |
| **Monitoring / Metrics**    | Prometheus-compatible metrics + managed dashboarding (e.g., Grafana)                                                            | Per-tenant tagging, SLO burn-rate alerting (§23)                                                  |
| **Tracing**                 | OpenTelemetry, exported to a distributed tracing backend                                                                        | Cross-service trace_id propagation (§25 Monitoring Standards, RULE-093)                           |
| **Logging**                 | Structured JSON logging shipped to a centralized, tenant-filterable log store                                                   | Mandatory redaction middleware (§24, RULE-046)                                                    |
| **Testing**                 | Unit + contract + integration + chaos + isolation test suites, run in CI                                                        | Matches Constitution §19 Testing Standards (coverage thresholds, contract tests, isolation tests) |
| **Secrets Management**      | Managed secrets manager (e.g., cloud-native secrets service or Vault)                                                           | RULE-060 — secrets never in code/config                                                           |
| **LLM Providers**           | Multi-provider via Model Router (primary + fallback chain)                                                                      | RULE-079/080 — no single-provider lock-in                                                         |

_(Specific vendor selection — e.g., which cloud provider, which exact managed Kafka/queue product — is deferred to an infrastructure-selection ADR once regional/compliance/cost constraints for launch markets are confirmed; the categories above are fixed by this Blueprint.)_

---

## 39. Closing Note

This Blueprint is the sole pre-implementation reference for AOS. Every subsequent implementation prompt (Agent build-out, Tool build-out, Workflow build-out, Registry seeding) must:

1. Identify which section(s) of this Blueprint it implements.
2. Confirm no Constitution RULE is violated (§0 Conflict Protocol).
3. Extend, never bypass, the pillars defined here (Event Bus, Registries, Tool Manager, Workflow Runtime, Agent Runtime, Model Router, Memory Service, Queue, Scheduler, Guardrail Engine, API Gateway, Observability stack).

No implementation code, agent code, tool code, or workflow code has been written in this document, per the stated scope.
