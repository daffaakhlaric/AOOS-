# Decision Matrix — Event Bus

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.8
Full record: [`tech-stack/event-bus.md`](../tech-stack/event-bus.md) | ADR: [`adr/ADR-TSR-008-event-bus.md`](../adr/ADR-TSR-008-event-bus.md)

## How to read this matrix

This matrix scores the same three candidates (NATS JetStream, Kafka, RabbitMQ) evaluated for the Event Streaming leg of §3.7 (`decision-matrix/queue.md`) — Event Bus and Event Streaming are the same underlying technical decision, documented as separate task-brief categories per the master TSR §3.8's own framing ("this category is the same underlying decision as Event Streaming above, listed separately per the task brief"). As with every TSR matrix: **Vendor Lock-in Risk** is scored 5 = lowest risk, and **Estimated Cost** is scored 5 = lowest relative cost, so higher is always better on every row, with no inverted dimensions.

## Matrix

| Dimension            | Weight | NATS JetStream | Kafka    | RabbitMQ |
| -------------------- | ------ | -------------- | -------- | -------- |
| Performance          | 8%     | 5              | 5        | 4        |
| Scalability          | 10%    | 4              | 5        | 4        |
| Reliability          | 14%    | 4              | 5        | 4        |
| Security             | 6%     | 4              | 4        | 4        |
| Maintainability      | 18%    | 4              | 2        | 4        |
| Developer Experience | 8%     | 4              | 3        | 4        |
| Ecosystem            | 8%     | 3              | 5        | 4        |
| Community Maturity   | 6%     | 3              | 5        | 5        |
| Licensing            | 4%     | 5              | 5        | 5        |
| Cloud Compatibility  | 6%     | 5              | 5        | 4        |
| Vendor Lock-in Risk  | 6%     | 4              | 4        | 4        |
| Estimated Cost       | 6%     | 4              | 2        | 4        |
| **Weighted Total**   | 100%   | **4.02**       | **4.02** | **4.10** |

## Weight justification

- **Maintainability (18%, highest weight)** — the deciding dimension for this category. Architecture ADR-001 requires a durable, replayable event bus, and _any_ of the three candidates satisfies that functional requirement — the discriminator is operational burden at AOS's actual target scale (master TSR §1 philosophy #1: multi-tenant cost efficiency over raw peak performance), which is exactly why the highest weight sits here rather than on raw Scalability or Ecosystem.
- **Reliability (14%)** — Domain Event delivery underpins nearly every cross-Bounded-Context interaction (DDD §12's 138-event catalog); a dropped or corrupted event has cascading correctness consequences across contexts, justifying an above-average weight.
- **Scalability, Developer Experience, Ecosystem (8-10% each)** — matter for the eventual Kafka migration decision and day-to-day engineering velocity, but are secondary to the near-term operational-burden calculus.
- **Community Maturity, Vendor Lock-in, Cloud Compatibility (6% each)** — long-term risk signals rather than near-term operational levers.
- **Licensing (4%, lowest weight)** — all three candidates are fully permissive OSS, so this dimension does not differentiate (same conclusion as the Queue matrix).

**Result:** the flattened weighted totals land within a narrow band (4.02–4.10) precisely because all three are structurally credible event-bus technologies — the Maintainability weighting is what tips the qualitative Final Recommendation toward NATS JetStream for AOS's near-term scale, even though the raw numeric spread alone would not obviously separate the candidates. This is a case where the matrix supports, but does not replace, the qualitative reasoning in `tech-stack/event-bus.md` §20's trade-off discussion — read both together.
