# Tech Stack Record — Event Bus

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.8
ADR: [`adr/ADR-TSR-008-event-bus.md`](../adr/ADR-TSR-008-event-bus.md)
Decision Matrix: [`decision-matrix/event-bus.md`](../decision-matrix/event-bus.md)

---

## 1. Objective

Confirm and document, as its own category per the task brief, the Event Bus technology underlying Architecture doc 002 §16 (Event-Driven Architecture) and Architecture ADR-001 (Event Bus for Cross-Context Communication), and the Event Contract's transport layer (doc 003.5). This category is the **same underlying decision as "Event Streaming" in §3.7/`tech-stack/queue.md`**, listed and documented separately because the task brief and the master TSR (§3.8) treat Event Bus as its own line item, distinct from the Job Queue leg of §3.7.

## 2. Requirements

Identical to the Event Streaming requirements in `tech-stack/queue.md` §2: durable, replayable, at-least-once delivery of Domain Events across Bounded Contexts (Architecture ADR-001); native multi-tenant subject/topic isolation; per-tenant fair-share consumption (Architecture ADR-011); acceptable operational burden for AOS's actual near-term scale target, not hyperscale-by-default over-provisioning.

## 3. Candidate Technologies

| Candidate            | Summary                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NATS (JetStream)** | Lightweight, cloud-native messaging system; JetStream is its persistence/streaming layer adding durable, replayable delivery on top of NATS Core's low-latency pub/sub. |
| **Kafka**            | The industry-standard distributed event log, with the deepest ecosystem and highest proven ceiling of any streaming technology evaluated.                               |
| **RabbitMQ**         | Mature AMQP broker; exchange/queue model rather than a log/stream model.                                                                                                |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best); **Vendor Lock-in Risk** — 5 = lowest risk; **Estimated Cost** — 5 = lowest relative cost.

| Dimension            | NATS JetStream | Kafka          | RabbitMQ    |
| -------------------- | -------------- | -------------- | ----------- |
| Performance          | 5              | 5              | 4           |
| Scalability          | 4              | 5              | 4           |
| Reliability          | 4              | 5              | 4           |
| Security             | 4              | 4              | 4           |
| Maintainability      | 4              | 2              | 4           |
| Developer Experience | 4              | 3              | 4           |
| Ecosystem            | 3              | 5              | 4           |
| Community Maturity   | 3              | 5              | 5           |
| Licensing            | 5 (Apache-2.0) | 5 (Apache-2.0) | 5 (MPL-2.0) |
| Cloud Compatibility  | 5              | 5              | 4           |
| Vendor Lock-in Risk  | 4              | 4              | 4           |
| Estimated Cost       | 4              | 2              | 4           |

## 5. Benchmark

See [`benchmarks/messaging-benchmarks.md`](../benchmarks/messaging-benchmarks.md) §"Event Streaming" — the same benchmark table cited in `tech-stack/queue.md` §5, since this is the identical underlying technology decision. Key directional findings: NATS JetStream and Kafka post comparably very-high single-broker throughput; NATS JetStream's operational complexity for a single-region cluster is rated Low (single binary, no external coordination service) versus Kafka's Medium-High (historically ZooKeeper-dependent; KRaft mode reduces but does not eliminate this per the benchmark file's own caveat); Kafka's consumer-group/partition ecosystem is rated the most mature of the three.

## 6. Performance

Both NATS JetStream and Kafka comfortably exceed AOS's projected near-term (Year 1–2, per `roadmap/technology-roadmap.md`) event volume. The performance dimension does not differentiate the decision for AOS's actual scale target — operational complexity to sustain that performance does (§10 below).

## 7. Scalability

Kafka's proven scalability ceiling at true hyperscale event volumes exceeds JetStream's — this is the specific, honestly-acknowledged reason it remains the documented migration path rather than being dismissed as a "smaller/worse" alternative. For AOS's actual multi-tenant-SaaS-not-hyperscale-event-firehose target (master TSR §1 philosophy #1), JetStream's scalability is sufficient.

## 8. Reliability

Kafka has the deepest and longest track record of reliable operation at extreme scale of any candidate. JetStream's durability/replay guarantees are architecturally sound (native stream-log model, at-least-once delivery) and sufficient for Architecture ADR-001's requirements, with a shorter overall track record than Kafka's as a streaming-specific durability layer (JetStream is younger than NATS Core itself).

## 9. Security

No material differentiation — all three support TLS, authentication (NATS: NKeys/JWT/decentralized auth; Kafka: SASL/mTLS/ACLs; RabbitMQ: SASL), and standard network isolation.

## 10. Maintainability

This is the decisive dimension: NATS JetStream is a single binary requiring no external coordination service, materially lowering the operational floor for a small-to-mid-size platform engineering team. Kafka's historical ZooKeeper dependency (and its continuing, if reduced, operational complexity even under KRaft mode) represents meaningfully more infrastructure to run, patch, and operate correctly — a cost that is justified only once event volume genuinely demands Kafka's ceiling, not before.

## 11. Developer Experience

NATS's subject-based addressing model is simpler to reason about for AOS's per-tenant event-partitioning needs than Kafka's topic/partition/consumer-group model. Client libraries for both are mature across TS/Go/Python (Compatibility Matrix, master TSR §6).

## 12. Ecosystem

Kafka's ecosystem (schema registries, Kafka Connect, the broadest tooling and consultant/operator talent pool in the industry) is the deepest of any candidate — explicitly the reason it is the named scale-up path rather than a discarded option. JetStream's ecosystem is smaller but includes a genuinely useful bonus not native to Kafka: a built-in KV/Object store, directly useful for Registry caching per the master TSR.

## 13. Community Maturity

Kafka and RabbitMQ both have long, large-scale production communities. NATS/JetStream is CNCF-adjacent and growing, with a smaller but active community; this is the same maturity trade-off already documented for Valkey (§3.6) — a younger, but credibly-backed, project accepted in exchange for a better fit to AOS's actual operating scale.

## 14. Licensing

All three candidates carry fully permissive OSS licenses: NATS/JetStream (Apache-2.0), Kafka (Apache-2.0), RabbitMQ (MPL-2.0). No licensing-risk disqualifier applies — the same conclusion as `tech-stack/queue.md` §14.

## 15. Cloud Compatibility

All three deploy self-hosted on Kubernetes or via managed offerings across every major cloud. No differentiation (Compatibility Matrix, master TSR §6).

## 16. Vendor Lock-in

Low for all three — open-source, self-hostable, multiple managed-service providers exist for each. No single-vendor dependency.

## 17. Estimated Cost

Per [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §6, the combined Queue/Event Streaming line (which includes this Event Bus decision) is estimated at **$200–$400/mo at 100 dealers, $1,500–$3,000/mo at 1,000 dealers, $10,000–$18,000/mo at 10,000 dealers** on NATS JetStream. Kafka's heavier operational footprint (more nodes, historically a coordination-service tier, generally higher minimum viable cluster size) makes it directionally more expensive to run at equivalent event volume — a material factor in why it is deferred until event volume specifically justifies it, consistent with cost model §12's "capacity-triggered, not calendar-triggered" governance principle.

## 18. Pros

**NATS JetStream:** lowest operational floor of the durable options evaluated; native replay satisfying Architecture ADR-001; built-in KV/Object store as a bonus; native multi-tenant subject-based partitioning maps cleanly onto AOS's per-tenant isolation needs.

## 19. Cons

**NATS JetStream:** smaller ecosystem/tooling depth and consumer-group maturity than Kafka; a genuinely lower proven ceiling at true hyperscale event volumes than Kafka's industry-leading track record.

## 20. Trade-offs

Choosing JetStream over Kafka accepts a lower ecosystem depth and a lower proven extreme-scale ceiling in exchange for a materially lower day-to-day operational burden appropriate to AOS's actual near-term scale (thousands of tenants, not internet-hyperscale event firehoses). This is a "right-sized for now, with a real escape hatch" decision, not a permanent ceiling — the master TSR is explicit that Kafka is a migration path, not a rejected technology.

## 21. Final Recommendation

Matching the master TSR §3.8 verbatim: **NATS JetStream** (identical underlying decision to §3.7's Event Streaming recommendation — this category is documented separately per the task brief's category list, not because it is a different technical decision). **Kafka** is the documented migration path once tenant/event volume crosses JetStream's comfortable ceiling (`migration/migration-and-upgrade-strategy.md`) — Kafka's schema registry and consumer-group ecosystem maturity make it the natural next step, not a discarded option. **RabbitMQ** remains a non-recommended alternative for the reasons documented in `tech-stack/queue.md` §20 (AMQP exchange/queue model is a worse structural fit for event-sourced replay than JetStream's stream-log model).

## 22. ADR Reference

[`adr/ADR-TSR-008-event-bus.md`](../adr/ADR-TSR-008-event-bus.md)

## 23. Migration Strategy

Per [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) §2, the named path is **NATS JetStream → Kafka**, triggered when sustained event throughput or consumer-group/partition complexity exceeds JetStream's comfortable single-cluster operating envelope (an operationally-defined threshold, deliberately not a fixed number chosen pre-launch). Migration approach: introduce Kafka as a secondary event bus for new high-volume event types first (least disruptive), bridge via a translation consumer so existing consumers are not broken mid-migration, migrate existing event types incrementally per Bounded Context (never a single big-bang cutover, consistent with Constitution §21 Versioning Strategy applied to infrastructure). This is the identical migration described in `tech-stack/queue.md` §23, since Event Bus and Event Streaming are the same underlying technology.

## 24. Future Consideration

Track JetStream consumer-group/partition-complexity and per-tenant event-volume metrics from the first production cohort via the LGTM Observability stack (§3.17), so the Kafka migration trigger is identified proactively (Risk Register RISK-003) rather than discovered reactively during an incident. Re-evaluate Kafka's operational cost profile (managed Kafka offerings, e.g., Confluent Cloud-class services, vs. self-hosted) at the time the trigger fires, since managed options may materially change the migration's operational-burden trade-off versus what is assumed today.
