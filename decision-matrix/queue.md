# Decision Matrix — Queue

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.7
Full record: [`tech-stack/queue.md`](../tech-stack/queue.md) | ADR: [`adr/ADR-TSR-007-queue.md`](../adr/ADR-TSR-007-queue.md)

## How to read this matrix

This category is a **split decision by use case** (Job Queue vs. Event Streaming vs. Delayed Jobs — see `tech-stack/queue.md` §21), so the matrix below is scored per-candidate against the full generic dimension set, but the weighted total should be read separately per use-case column group, not as one global winner. **BullMQ** is the Job Queue/short-horizon-Delayed-Jobs winner; **NATS JetStream** is the Event Streaming/long-horizon-complement winner; both are simultaneously "correct" for their respective use case. Kafka's relatively strong weighted total below reflects its strength as the future migration path, not a claim that it should be adopted today — see `migration/migration-and-upgrade-strategy.md` for the named trigger condition. As with all TSR matrices: **Vendor Lock-in Risk** is scored 5 = lowest risk, and **Estimated Cost** is scored 5 = lowest relative cost, so higher is always better across every row.

## Matrix

| Dimension            | Weight | BullMQ (on Valkey) | Redis Streams | RabbitMQ | Kafka    | NATS JetStream |
| -------------------- | ------ | ------------------ | ------------- | -------- | -------- | -------------- |
| Performance          | 10%    | 4                  | 4             | 4        | 5        | 5              |
| Scalability          | 10%    | 3                  | 3             | 4        | 5        | 4              |
| Reliability          | 12%    | 4                  | 3             | 4        | 5        | 4              |
| Security             | 6%     | 4                  | 4             | 4        | 4        | 4              |
| Maintainability      | 14%    | 5                  | 4             | 4        | 2        | 4              |
| Developer Experience | 10%    | 5                  | 3             | 4        | 3        | 4              |
| Ecosystem            | 8%     | 4                  | 3             | 4        | 5        | 3              |
| Community Maturity   | 6%     | 4                  | 4             | 5        | 5        | 3              |
| Licensing            | 4%     | 5                  | 5             | 5        | 5        | 5              |
| Cloud Compatibility  | 6%     | 5                  | 5             | 4        | 5        | 5              |
| Vendor Lock-in Risk  | 6%     | 4                  | 4             | 4        | 4        | 4              |
| Estimated Cost       | 8%     | 4                  | 4             | 4        | 2        | 4              |
| **Weighted Total**   | 100%   | **4.16**           | **3.72**      | **4.10** | **4.02** | **4.07**       |

## Weight justification

- **Maintainability (14%, highest weight)** — this is the single most decisive dimension for AOS's actual scale target (master TSR §1 philosophy #1: multi-tenant cost efficiency over raw peak performance); it is why JetStream beats Kafka for the near-term Event Streaming decision despite Kafka's higher raw Scalability/Ecosystem scores, and why BullMQ (zero incremental infrastructure) wins the Job Queue decision outright.
- **Reliability (12%)** — durability of Domain Events and job retries is core-domain-critical (nurturing sequences, DDD §2 Domain Vision), weighted above average across all dimensions.
- **Performance, Scalability, Developer Experience (10% each)** — reflect the throughput and hands-on engineering-velocity needs of a TypeScript-first (master TSR §1 philosophy #4) platform.
- **Ecosystem, Cloud Compatibility, Vendor Lock-in, Community Maturity (6-8% each)** — matter for long-term platform risk but are secondary to the operational-burden-at-actual-scale calculus that Maintainability captures directly.
- **Licensing (4%, lowest weight)** — unlike Cache (§3.6), every finalist candidate in this category carries a fully permissive OSS license, so this dimension does not differentiate and is weighted accordingly low.

**Result:** BullMQ (4.16) and RabbitMQ (4.10) post the two highest weighted totals in a flattened single-table view, but this table format cannot express the use-case split that actually drives the decision — RabbitMQ's strong raw score does not overcome its structural mismatch with event-sourced replay (Architecture ADR-001), detailed qualitatively in `tech-stack/queue.md` §7 and §20. Read the Final Recommendation in the full record, not the raw weighted-total ranking alone, for the binding decision.
