# ADR-TSR-007 — BullMQ for Job Queue, NATS JetStream for Event Streaming and Delayed-Job Complement

**Status:** Accepted

**Context:** The Queue Contract (doc 003.5) and Architecture doc 002 §26 require durable handling of three structurally different access patterns: (a) short-lived, high-cardinality Job Queue work (Tool retries, notification dispatch) needing visibility-timeout-style redelivery and DLQ support; (b) durable, replayable Event Streaming of Domain Events (doc 003 §12's 138-event catalog) across Bounded Contexts, satisfying Architecture ADR-001's event-sourced cross-context communication model; and (c) Delayed Jobs spanning both short/medium horizons (Follow-Up Reminder Policy, DDD §15) and long/recurring horizons (Lead Expiry Policy). No single technology serves all three patterns equally well without compromising at least one of them.

**Decision:** Adopt a **split technology decision by use case**:

- **Job Queue and short/medium-horizon Delayed Jobs**: BullMQ, running on the already-selected Valkey cache (§3.6/ADR-TSR-006), adding zero incremental broker infrastructure.
- **Event Streaming and the long-horizon Delayed Jobs complement**: NATS JetStream, providing durable, replayable, at-least-once Domain Event delivery with native multi-tenant subject-based partitioning; long-horizon/recurring delayed triggers are additionally served by Scheduler Contract-driven cron/interval jobs (doc 003.5 §3.12), not by JetStream's own delay mechanism.
- RabbitMQ and plain Redis Streams are evaluated and not adopted as the primary technology for either pattern.

**Consequences:**

- Two messaging technologies are operated instead of one, adding cross-technology operational surface (two sets of monitoring dashboards, two failure domains, two upgrade cadences) — an intentional trade-off, not an oversight, per `tech-stack/queue.md` §20.
- BullMQ's native TypeScript/NestJS integration (§3.1/§3.2) gives the highest-frequency async workload (Tool retries, notifications) the lowest possible added infrastructure and the best developer experience of any evaluated option.
- NATS JetStream's lower operational floor (single binary, no external coordination service) keeps Event Streaming operable by a small early engineering team while still meeting Architecture ADR-001's durability/replay requirement.
- The platform is committed to monitoring JetStream's operating envelope proactively (Risk Register RISK-003) so the Kafka migration trigger, once it fires, is acted on deliberately rather than reactively.

**Alternatives Considered:**

- **RabbitMQ** (for either pattern) — rejected as primary: its AMQP exchange/queue model is a structurally worse fit for event-sourced replay than JetStream's stream-log model; remains a credible fallback only if the team acquires strong existing RabbitMQ operational expertise.
- **Kafka** (for Event Streaming, at this stage) — rejected as the _starting_ technology, not rejected outright: its operational floor (historically ZooKeeper-dependent, materially more configuration surface) exceeds what AOS's actual near-term event volume justifies; explicitly retained as the pre-documented scale-up migration path (`migration/migration-and-upgrade-strategy.md`).
- **Redis Streams** (for Job Queue) — rejected in favor of the purpose-built BullMQ library, which offers a more complete priority/delay/DLQ feature set on top of the same underlying Valkey store, at no additional infrastructure cost over raw Streams.
- **A single unified technology for all three patterns** (e.g., "just use Kafka for everything," or "just use BullMQ for everything") — rejected: forcing one technology to serve both the ephemeral, high-cardinality Job Queue pattern and the durable, replayable Event Streaming pattern would degrade at least one use case's semantics to accommodate the other.
