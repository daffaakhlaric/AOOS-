# ADR-TSR-009 — Temporal as the Durable Workflow Engine (Inngest/Trigger.dev Permitted as a Planned MVP Path)

**Status:** Accepted

**Context:** The Workflow Contract (doc 003.5 §4) and Architecture doc 002 §15 / ADR-007 require a durable execution engine for multi-step, crash-resumable business processes — nurturing sequences, campaign processes, and any process spanning days to weeks — with native saga/compensation support and strong in-flight-state observability. DDD §2 Domain Vision states plainly that nurturing sequences must never silently die, making this a core-domain-critical reliability requirement, not a nice-to-have. A small early engineering team must also be able to reach production velocity without being blocked on standing up and learning a non-trivial additional stateful service before shipping a first workflow.

**Decision:** Adopt **Temporal** as the target durable Workflow Engine architecture. **Inngest or Trigger.dev are explicitly permitted as an MVP-acceleration starting point** for a small early team prioritizing time-to-first-workflow-in-production, on the condition that the migration path to Temporal is planned from day one (per `migration/migration-and-upgrade-strategy.md`), not deferred as an open-ended "maybe later." A fully custom Internal Workflow Engine is rejected.

**Consequences:**

- If Temporal is adopted directly, the platform takes on the operational cost of running Temporal Server plus its own persistence store (Postgres/Elasticsearch-backed) from day one, in exchange for the strongest available durability guarantee category (deterministic replay-from-event-history) and a proven multi-tenant SaaS scale track record.
- If Inngest/Trigger.dev is chosen for MVP speed, the platform accepts a genuine managed-vendor dependency on its core-domain-critical workflow execution path (Risk Register RISK-002) and commits to executing the pre-planned Temporal migration once multi-week durable Nurturing Sequences become the production norm rather than the exception — this commitment must be tracked, not left implicit.
- Workflow definitions are always authored against the Workflow Contract's own `state_machine`/`nodes`/`edges`/`compensation` schema (doc 003.5 §4), regardless of which engine executes them, so a future Temporal migration is a runtime-target swap under an already-stable Contract rather than a redesign of workflow logic itself.
- Building and independently proving a custom durability/compensation/observability layer from scratch is explicitly avoided, in direct application of Constitution §1.2 ("don't reinvent solved problems").

**Alternatives Considered:**

- **Inngest / Trigger.dev as the permanent target** (not just MVP-stage) — not adopted as the long-term architecture: both offer less battle-tested durability guarantees at AOS's eventual thousands-of-tenant target than Temporal's proven track record, and using their managed control plane permanently would leave a core-domain-critical capability under a third-party commercial dependency indefinitely rather than as a deliberate, time-boxed early-stage trade-off.
- **Internal Workflow Engine (build from scratch)** — rejected: Temporal already solves the hardest part of this problem (deterministic replay-based durability) to a standard that would take significant, high-risk engineering time to match, and doing so would directly contradict Constitution §1.2. An internal engine's reliability is, by definition, unproven at the time of the decision — it would be AOS's own first proof of a notoriously hard distributed-systems problem, an unacceptable risk to place under a Core Domain capability.
