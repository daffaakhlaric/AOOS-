# Tech Stack Record — Workflow Engine

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.9
ADR: [`adr/ADR-TSR-009-workflow-engine.md`](../adr/ADR-TSR-009-workflow-engine.md)
Decision Matrix: [`decision-matrix/workflow-engine.md`](../decision-matrix/workflow-engine.md)

---

## 1. Objective

Choose the durable execution engine implementing the Workflow Contract (doc 003.5 §4) and satisfying Architecture doc 002 §15 / ADR-007 (Workflow Engine for Multi-Step, Durable Business Processes). This engine is the runtime for AOS's nurturing sequences, campaign processes, and any multi-step Agent-driven business process that must survive days-to-weeks of elapsed time and arbitrary crashes without losing state.

## 2. Requirements

- Crash-resumable execution — a process restart, deploy, or node failure must never silently lose in-flight workflow state (DDD §2 Domain Vision: nurturing sequences must never silently die).
- Native saga/compensation pattern support for multi-step processes with partial-failure rollback semantics.
- Durable state retention spanning multi-day to multi-week horizons (nurturing sequences, DDD §17.3 Core Domain).
- Strong observability of in-flight workflow state (which step a given Lead/Campaign instance is on, replayable execution history for debugging and audit).
- Compatibility with the Workflow Contract's own `state_machine`/`nodes`/`edges`/`compensation` schema (doc 003.5 §4) as the platform's own abstraction — the engine must be a runtime target under that Contract, not a replacement for it.

## 3. Candidate Technologies

| Candidate                    | Summary                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Temporal**                 | Open-source durable execution platform; workflow code re-executes deterministically from event history on any restart, giving the strongest class of durability guarantee among current options. |
| **Inngest**                  | Managed (with self-host option) durable step-function platform, optimized for fast developer setup on top of standard application code.                                                          |
| **Trigger.dev**              | Similar category to Inngest — managed durable background jobs/workflows with a strong TypeScript-first developer experience.                                                                     |
| **Internal Workflow Engine** | A fully custom-built durability/retry/compensation/observability layer, built from scratch by AOS engineering.                                                                                   |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best); **Vendor Lock-in Risk** — 5 = lowest risk; **Estimated Cost** — 5 = lowest relative cost.

| Dimension            | Temporal               | Inngest                                          | Trigger.dev                                      | Internal Engine                                       |
| -------------------- | ---------------------- | ------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------- |
| Performance          | 4                      | 4                                                | 4                                                | Unknown (2, unproven)                                 |
| Scalability          | 5                      | 4                                                | 4                                                | Unknown (2, unproven)                                 |
| Reliability          | 5                      | 4                                                | 4                                                | Unknown (1, unproven by definition)                   |
| Security             | 4                      | 4                                                | 4                                                | 3 (full control, but unaudited)                       |
| Maintainability      | 3                      | 5                                                | 5                                                | 1                                                     |
| Developer Experience | 3                      | 5                                                | 5                                                | 2                                                     |
| Ecosystem            | 4                      | 3                                                | 3                                                | 1                                                     |
| Community Maturity   | 4                      | 3                                                | 3                                                | 1 (none — internal only)                              |
| Licensing            | 5 (MIT, server + SDKs) | 4 (SDK OSS; managed control plane is commercial) | 4 (SDK OSS; managed control plane is commercial) | 5 (fully owned)                                       |
| Cloud Compatibility  | 5                      | 4                                                | 4                                                | 5                                                     |
| Vendor Lock-in Risk  | 4                      | 3                                                | 3                                                | 5 (but at a very high build/maintain cost)            |
| Estimated Cost       | 3                      | 4                                                | 4                                                | 2 (hidden cost in engineering time, not billed infra) |

## 5. Benchmark

See [`benchmarks/workflow-engine-benchmarks.md`](../benchmarks/workflow-engine-benchmarks.md) for the full directional comparison (durability guarantee model, operational setup cost, time-to-first-workflow-in-production, proven multi-tenant SaaS scale track record, compensation/saga pattern support). Per that file's stated methodology: directional comparison from vendor documentation and public case studies, not AOS-measured.

## 6. Performance

Temporal, Inngest, and Trigger.dev all perform adequately for AOS's workflow-invocation volume (nurturing-sequence steps, campaign process steps — a materially lower-frequency, higher-per-step-value workload than, e.g., raw Domain Event volume on the Event Bus). Performance is not the differentiating dimension for this category; durability guarantee model is (§7-8 below).

## 7. Scalability

Temporal has the strongest proven scalability track record at multi-tenant SaaS scale of the evaluated options, per `benchmarks/workflow-engine-benchmarks.md`'s "Proven multi-tenant SaaS scale track record" row (rated Strong for Temporal vs. Growing/newer for both Inngest and Trigger.dev). This directly matters for AOS's eventual thousands-of-dealer target.

## 8. Reliability

This is the single most decisive dimension for the Workflow Engine category. Temporal's deterministic-replay-from-event-history model is, per the benchmark file, in the "strongest guarantee category" — workflow code is re-executed from its full event history on any restart, giving a mathematically strong resumability guarantee rather than a best-effort one. Inngest and Trigger.dev both offer "strong" durable step-function guarantees under a different underlying model, genuinely credible but with less time in market at extreme scale. An Internal Engine's reliability is unproven by definition — it would be AOS's own first proof of a notoriously hard distributed-systems problem (deterministic durable execution).

## 9. Security

No material differentiation between Temporal/Inngest/Trigger.dev — all support standard TLS, RBAC/namespace isolation (Temporal namespaces map naturally to AOS's per-tenant isolation model), and audit logging. An Internal Engine would need this security surface built and independently audited from scratch, a real and easily underestimated cost.

## 10. Maintainability

Here the trade-off inverts relative to Reliability: Inngest and Trigger.dev, being largely managed, require materially less day-to-day operational maintenance than self-hosted Temporal (which requires running Temporal Server plus its own Postgres/Elasticsearch-backed persistence store — a genuinely non-trivial additional stateful service, per the master TSR's own trade-off note). This is precisely the tension the master TSR resolves by explicitly permitting an Inngest/Trigger.dev MVP path with a planned migration, rather than forcing every team stage onto Temporal's higher operational floor from day one.

## 11. Developer Experience

Inngest and Trigger.dev are both purpose-built for fast time-to-first-workflow-in-production with a lower learning curve (per the benchmark file's "Time-to-first-workflow-in-production" row: rated Fast for both vs. "Slower initial ramp" for Temporal, which requires learning deterministic-workflow-code constraints — e.g., no non-deterministic operations directly inside workflow code, all side effects via Activities). This is a real, not dismissed, DX cost of choosing Temporal.

## 12. Ecosystem

Temporal has the deepest ecosystem of the four (official SDKs in TypeScript, Go, Python, Java; a mature operator/tooling landscape including a Kubernetes operator, directly relevant to the already-selected Orchestration category §3.20). Inngest and Trigger.dev have smaller but actively growing ecosystems focused specifically on the TypeScript/serverless niche.

## 13. Community Maturity

Temporal has multiple large-scale public case studies and a mature open-source community (per the benchmark file's community-maturity row). Inngest and Trigger.dev are both newer products with growing but less-established communities. An Internal Engine has no external community by definition.

## 14. Licensing

Temporal Server and all official SDKs are MIT-licensed, fully open source with no restrictive terms — directly aligned with the master TSR's guiding philosophy #2. Inngest and Trigger.dev both offer open-source SDKs/execution libraries, but their primary managed offering (the hosted control plane most teams actually run against for the "fast MVP" path) is a commercial product — not a licensing risk in the Cache-relicensing sense, but a genuine commercial dependency if the managed tier is used rather than self-hosting.

## 15. Cloud Compatibility

Temporal deploys self-hosted on Kubernetes (with an official Temporal Kubernetes Operator, directly compatible with the already-selected Orchestration §3.20) or via Temporal Cloud (managed). Inngest and Trigger.dev are primarily consumed as managed/serverless-deployed services, with self-host options existing but less commonly used in practice. All are deployable within AOS's Kubernetes-centric infrastructure model (Compatibility Matrix, master TSR §6).

## 16. Vendor Lock-in

Self-hosted Temporal carries the lowest vendor lock-in of the three real candidates — it is fully open-source infrastructure the platform operates itself. Using Inngest's or Trigger.dev's managed control plane (the fast-path MVP option) introduces a genuine vendor dependency for workflow execution, which is precisely why the master TSR requires that any team choosing that MVP path plan the Temporal migration from day one rather than treating it as optional. An Internal Engine has zero third-party lock-in but at the cost of the highest all-in engineering investment of any option.

## 17. Estimated Cost

Workflow Engine infrastructure is not broken out as its own line in [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) — self-hosted Temporal's persistence store (Postgres-backed) and compute run within the general Compute Infrastructure and Database cost lines (§3, §4 of the cost model: $1,500–$90,000/mo and $600–$55,000/mo respectively across the three tiers). Temporal's incremental cost over "no workflow engine" is real but modest relative to the platform's dominant AI/LLM inference line (§2 of the cost model, 40-65% of total spend per the master TSR §5 key takeaway). Inngest/Trigger.dev's managed-tier pricing is typically usage-metered (per-step/per-run), which can be cheaper at very small scale but is a distinct commercial cost line not currently modeled in the cost-analysis file — an explicit gap to close if the MVP path is chosen (see Future Consideration below).

## 18. Pros

**Temporal:** strongest class of durability guarantee (deterministic replay); proven at multi-tenant SaaS scale elsewhere in the industry; native saga/compensation support; MIT-licensed, fully self-hostable, no vendor lock-in; Kubernetes-native operator available.
**Inngest/Trigger.dev:** materially faster time-to-first-workflow-in-production; lower initial operational setup cost; strong TypeScript-first DX matching master TSR §1 philosophy #4.

## 19. Cons

**Temporal:** requires operating a non-trivial additional stateful service (Temporal Server + its own persistence store); steeper learning curve for deterministic-workflow-code constraints; slower initial ramp for a small early team.
**Inngest/Trigger.dev:** less battle-tested durability guarantees at thousands-of-tenant target scale than Temporal's proven track record; managed-tier usage introduces a genuine third-party vendor dependency on the platform's core-domain-critical workflow execution path.

## 20. Trade-offs

Temporal's operational cost is accepted because Workflow durability is core-domain-critical (DDD §2 Domain Vision — nurturing sequences must never silently die), and no alternative in the candidate set matches its durability guarantee category at proven multi-tenant SaaS scale. Building a fully Internal Workflow Engine is explicitly rejected: Temporal already solves the hardest part of this problem (deterministic replay-based durability) to a standard that would take significant, high-risk engineering time to match, directly contradicting Constitution §1.2's "don't reinvent solved problems" principle.

## 21. Final Recommendation

Matching the master TSR §3.9 verbatim: **Temporal** — its durable-execution model is architecturally the closest match to the Workflow Contract's `state_machine`/`compensation`/resumability requirements of any available technology, and it is proven at multi-tenant SaaS scale elsewhere in the industry. **Inngest / Trigger.dev are flagged as a legitimate MVP-acceleration alternative** — both offer a materially lower operational setup cost and better out-of-box DX for a small early team, at the cost of less battle-tested durability guarantees at our eventual thousands-of-tenant target; if the team chooses to start there for speed, the migration path to Temporal must be planned from day one rather than treated as a "maybe later." **Building a fully Internal Workflow Engine is not recommended** — Temporal already solves the hardest part of this problem to a standard that would take significant engineering time to match, and doing so would contradict Constitution §1.2.

## 22. ADR Reference

[`adr/ADR-TSR-009-workflow-engine.md`](../adr/ADR-TSR-009-workflow-engine.md)

## 23. Migration Strategy

Per [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) §2, the named path is **Inngest/Trigger.dev (if chosen for MVP) → Temporal**, described as "a planned migration checkpoint, not a reactive one — targeted at the point where multi-week durable Nurturing Sequences (DDD §17.3, Core Domain) are the norm rather than the exception in production." Migration approach: re-implement Workflow definitions against the Workflow Contract's `state_machine`/`nodes`/`edges` model (doc 003.5 §4) targeting the Temporal SDK; because the Workflow Contract is the platform's own abstraction (not Inngest/Trigger.dev's native format), this migration is a runtime-target swap under an already-stable Contract, not a redesign. Risk Register RISK-002 (Temporal operational complexity underestimated by a small early team) is the direct risk this migration path is designed to manage — the MVP option exists precisely to de-risk early velocity without foreclosing the long-term durability target.

## 24. Future Consideration

If the Inngest/Trigger.dev MVP path is chosen, add an explicit usage-metered cost line for the managed control plane to `cost-analysis/cost-model-100-1000-10000-dealers.md` before the first production cohort, since that cost is not currently modeled there (§17 above). Re-evaluate the Temporal-migration trigger condition against real production Nurturing Sequence volume at the Year 1 checkpoint (`roadmap/technology-roadmap.md`), not on a fixed calendar date.
