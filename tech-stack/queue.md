# Tech Stack Record — Queue

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.7
ADR: [`adr/ADR-TSR-007-queue.md`](../adr/ADR-TSR-007-queue.md)
Decision Matrix: [`decision-matrix/queue.md`](../decision-matrix/queue.md)

---

## 1. Objective

Choose the technology (or technologies) implementing the Queue Contract's (doc 003.5) three distinct access patterns — **(a) Job Queue** (Tool retries, Notification dispatch, short-lived async work), **(b) Event Streaming** (Domain Events, cross-Bounded-Context pub/sub with replay), and **(c) Delayed Jobs** (Follow-Up Reminder Policy, Lead Expiry Policy) — per Architecture doc 002 §26. This category is deliberately evaluated as a split decision, not a single winner-take-all technology, because the master TSR (§3.7) establishes that these three access patterns have genuinely different structural requirements.

## 2. Requirements

- Durable delivery (messages/jobs must survive a consumer crash).
- Per-tenant fair-share capability (Architecture ADR-011 — no single tenant's volume may starve another's).
- Dead-letter queue (DLQ) support for poison messages / permanently-failing jobs.
- Visibility-timeout-style or equivalent idempotent redelivery semantics, so a crashed-mid-processing worker does not silently drop work.
- Native delayed/scheduled execution for the Delayed Jobs pattern (seconds-to-days horizon).
- Low added operational surface relative to the rest of the already-selected stack (Valkey §3.6, NATS JetStream §3.8).

## 3. Candidate Technologies

| Candidate          | Role Evaluated For                                                             |
| ------------------ | ------------------------------------------------------------------------------ |
| **BullMQ**         | Job Queue, Delayed Jobs (short/medium horizon)                                 |
| **Redis Streams**  | Job Queue / lightweight streaming alternative                                  |
| **RabbitMQ**       | Job Queue / Event Streaming (AMQP model)                                       |
| **Kafka**          | Event Streaming (evaluated primarily as the §3.8 migration path)               |
| **NATS JetStream** | Event Streaming, Delayed Jobs (long-horizon complement via Scheduler Contract) |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best); **Vendor Lock-in Risk** — 5 = lowest risk; **Estimated Cost** — 5 = lowest relative cost. Scored against the platform's actual use-case split (Job Queue vs. Event Streaming), not a single generic "message queue" yardstick — see `decision-matrix/queue.md` for the weighting rationale.

| Dimension            | BullMQ (on Valkey) | Redis Streams                    | RabbitMQ    | Kafka          | NATS JetStream |
| -------------------- | ------------------ | -------------------------------- | ----------- | -------------- | -------------- |
| Performance          | 4                  | 4                                | 4           | 5              | 5              |
| Scalability          | 3                  | 3                                | 4           | 5              | 4              |
| Reliability          | 4                  | 3                                | 4           | 5              | 4              |
| Security             | 4                  | 4                                | 4           | 4              | 4              |
| Maintainability      | 5                  | 4                                | 4           | 2              | 4              |
| Developer Experience | 5                  | 3                                | 4           | 3              | 4              |
| Ecosystem            | 4                  | 3                                | 4           | 5              | 3              |
| Community Maturity   | 4                  | 4                                | 5           | 5              | 3              |
| Licensing            | 5 (MIT)            | 5 (part of Valkey, BSD-3-Clause) | 5 (MPL-2.0) | 5 (Apache-2.0) | 5 (Apache-2.0) |
| Cloud Compatibility  | 5                  | 5                                | 4           | 5              | 5              |
| Vendor Lock-in Risk  | 4                  | 4                                | 4           | 4              | 4              |
| Estimated Cost       | 4                  | 4                                | 4           | 2              | 4              |

## 5. Benchmark

See [`benchmarks/messaging-benchmarks.md`](../benchmarks/messaging-benchmarks.md) §"Event Streaming" for the NATS JetStream / Kafka / RabbitMQ directional comparison (single-broker throughput, operational complexity, replay semantics, consumer-group ecosystem maturity, multi-tenant isolation model). BullMQ itself is not separately benchmarked there since it is a library on top of the already-benchmarked Valkey (§3.6), not an independent broker technology — its throughput characteristics are bounded by Valkey's.

## 6. Performance

BullMQ inherits Valkey's sub-millisecond primitive latency, which is more than sufficient for job-queue-shaped workloads (Tool retries, notification dispatch) where job volume per tenant is orders of magnitude lower than raw event volume. NATS JetStream and Kafka both report very high single-broker throughput per `benchmarks/messaging-benchmarks.md`; the deciding performance-adjacent factor for AOS is not raw ceiling (both comfortably exceed AOS's near-term event volume) but operational complexity to sustain that ceiling, which is where JetStream wins for AOS's actual scale target.

## 7. Scalability

Kafka has the highest proven ceiling of any candidate at hyperscale event volumes, which is precisely why it is retained as the explicit migration path rather than dismissed. JetStream scales comfortably within AOS's projected thousands-of-tenant range via its native clustering. BullMQ's scalability is bounded by Valkey's — acceptable because job-queue cardinality (per-Tool-call, per-notification) is a much smaller volume class than Domain Event streaming.

## 8. Reliability

All candidates offer durable, at-least-once delivery when correctly configured. Kafka's reliability track record at extreme scale is the deepest of any candidate (widest set of large-scale public production case studies). JetStream provides durable, replayable, at-least-once delivery sufficient for AOS's Domain Event replay requirements (Architecture ADR-001) without Kafka's operational floor. BullMQ's reliability is bounded by Valkey's persistence/replication guarantees (§3.6).

## 9. Security

No material differentiation — all candidates support TLS transport, authentication (NATS: NKeys/JWT; Kafka: SASL/mTLS; RabbitMQ: SASL; BullMQ: inherits Valkey ACLs), and network-level isolation.

## 10. Maintainability

This is where JetStream's advantage over Kafka is most concrete: JetStream is a single binary with no external coordination service requirement, while Kafka historically required ZooKeeper (KRaft mode reduces but, per the benchmark file, does not eliminate this operational floor). BullMQ adds effectively zero incremental operational surface since it reuses the already-deployed Valkey instance (§3.6) rather than requiring a separate broker.

## 11. Developer Experience

BullMQ is purpose-built for Node.js/TypeScript and integrates natively with NestJS (§3.2), giving it the strongest DX of any candidate for AOS's TypeScript-first codebase (master TSR §1 philosophy #4). NATS's client libraries are mature across TS/Go/Python (Compatibility Matrix, master TSR §6). Kafka's client ecosystem is the most mature in the industry overall but carries more configuration surface per topic/consumer-group than JetStream's subject-based model.

## 12. Ecosystem

Kafka has the single widest ecosystem of any streaming technology evaluated (schema registries, Kafka Connect, the broadest consumer-group tooling landscape) — this is explicitly why it remains the named scale-up migration path rather than a rejected option. JetStream's ecosystem is smaller but growing, and its built-in KV/Object store is a direct operational bonus (useful for Registry caching per the master TSR). BullMQ's ecosystem is the mature, well-documented Node.js job-queue library landscape.

## 13. Community Maturity

Kafka and RabbitMQ both have long, large-scale production histories. NATS/JetStream's community is smaller but growing and CNCF-adjacent. BullMQ is a mature, actively maintained library with wide adoption in the Node.js ecosystem specifically.

## 14. Licensing

All final candidates carry fully permissive open-source licenses: BullMQ (MIT), NATS JetStream (Apache-2.0), Kafka (Apache-2.0), RabbitMQ (MPL-2.0). No licensing-risk disqualifier applies to this category (unlike Cache §3.6) — the decision is driven by structural/operational fit, not license terms.

## 15. Cloud Compatibility

All candidates are deployable self-hosted on Kubernetes or via managed offerings on every major cloud (Compatibility Matrix, master TSR §6). No differentiation.

## 16. Vendor Lock-in

Low across all candidates — all are open-source, self-hostable, with multiple managed-service providers available where a managed option is preferred. No single-vendor dependency risk in this category.

## 17. Estimated Cost

Per [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §6, the combined Queue/Event Streaming line (BullMQ infrastructure — effectively free beyond the already-budgeted Valkey line — plus NATS JetStream) is estimated at **$200–$400/mo at 100 dealers, $1,500–$3,000/mo at 1,000 dealers, and $10,000–$18,000/mo at 10,000 dealers**. Kafka is directionally more expensive to operate at equivalent volume due to its heavier operational footprint (more nodes, historically a coordination-service tier), which is reflected in the cost model's Kafka-migration cost sensitivity note (§11: "any of the escape-hatch technologies... treat as capacity-triggered, not calendar-triggered").

## 18. Pros

**BullMQ (Job Queue):** zero incremental infrastructure (reuses Valkey); native TypeScript/NestJS integration; mature priority/delay/DLQ feature set purpose-built for the job-queue access pattern.
**NATS JetStream (Event Streaming/Delayed Jobs complement):** lowest operational floor of any durable streaming technology evaluated; native replay semantics matching Architecture ADR-001's event-sourced requirement; built-in KV/Object store as a bonus capability.

## 19. Cons

**BullMQ:** tightly coupled to the Node.js ecosystem (not a general polyglot solution, though this is not a problem given the master TSR §3.1 TypeScript-first default); its scalability ceiling is bounded by Valkey, unsuitable for platform-wide Domain Event volume (which is precisely why it is not used for that purpose).
**NATS JetStream:** smaller ecosystem and consumer-group tooling maturity than Kafka; a genuinely lower proven ceiling at extreme hyperscale event volumes, which is why Kafka remains the named migration path rather than being ruled out.

## 20. Trade-offs

Running two messaging technologies (BullMQ-on-Valkey and NATS JetStream) side-by-side instead of one unified technology is more moving parts to operate. This is accepted because the two access patterns are structurally different: ephemeral, low-latency, high-cardinality per-job semantics (Job Queue) versus durable, replayable, cross-context event log semantics (Event Streaming) — forcing a single technology to serve both (e.g., "just use Kafka for everything," or "just use BullMQ for everything") would degrade one use case to serve the other adequately, which the master TSR explicitly rejects (§3.7).

## 21. Final Recommendation

Matching the master TSR §3.7 verbatim, split by use case:

- **Job Queue** (Tool retries, Notification dispatch, short-lived async work): **BullMQ**, running on Valkey (§3.6) — mature Node.js job-queue library with native delayed jobs, priority, and DLQ support, minimal added infrastructure since it reuses the Valkey deployment.
- **Event Streaming** (Domain Events, doc 003 §12's 138 events, cross-Bounded-Context pub/sub with replay): **NATS JetStream** — chosen over Kafka for AOS's actual scale target: materially lower operational burden, built-in KV/Object store useful for Registry caching, native multi-tenant subject-based partitioning, while still providing durable, replayable, at-least-once delivery. Kafka is not disqualified — it is the explicit scale-up migration path once/if event volume outgrows JetStream's comfortable operating envelope.
- **Delayed Jobs**: BullMQ's native delay for short/medium horizons (seconds to days — e.g., Follow-Up Reminder Policy from DDD §15); Scheduler Contract-driven cron/interval jobs (doc 003.5 §3.12) for long-horizon/recurring triggers (e.g., Lead Expiry Policy).
- **RabbitMQ is not recommended** as a primary choice — its AMQP exchange/queue model is a worse structural fit for event-sourced replay (Architecture ADR-001) than JetStream's stream-log model, though it remains a credible alternative if the team has strong existing RabbitMQ operational expertise.

## 22. ADR Reference

[`adr/ADR-TSR-007-queue.md`](../adr/ADR-TSR-007-queue.md)

## 23. Migration Strategy

Per [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) §2, the named path is **NATS JetStream → Kafka**, triggered when "sustained event throughput or consumer-group/partition complexity exceeds JetStream's comfortable single-cluster operating envelope (defined operationally, not by a fixed number chosen pre-launch)." Migration approach: introduce Kafka as a secondary event bus for new high-volume event types first (least disruptive), bridge via a translation consumer, migrate existing event types incrementally per Bounded Context — never a single big-bang cutover. The Job Queue leg (BullMQ) is not part of this migration path; it remains bound to Valkey and migrates only if/when Cache (§3.6) migrates to DragonflyDB, per that category's own migration trigger.

## 24. Future Consideration

Monitor JetStream consumer-group/partition-complexity metrics from the first production cohort onward (Risk Register RISK-003) so the Kafka migration trigger is identified proactively via Observability (§3.17), not discovered reactively under production pressure. RabbitMQ remains a documented fallback option if the team ever acquires strong pre-existing RabbitMQ operational expertise (e.g., via acquisition or hire), though it is not the default path.
