# ADR-TSR-008 — NATS JetStream as the Event Bus

**Status:** Accepted

**Context:** Architecture ADR-001 mandates that all cross-Bounded-Context communication happen via published, versioned events on a central Event Bus, to keep Bounded Contexts (Lead, Campaign, Content, Conversation, Analytics, and others per DDD §9) decoupled at the deploy-cadence and failure-domain level. This event bus must support durable, replayable, at-least-once delivery (satisfying doc 003 §12's 138-event Domain Event catalog and Architecture ADR-001's decoupling intent), native multi-tenant subject/topic isolation, and per-tenant fair-share consumption (Architecture ADR-011). This is the identical underlying technical requirement documented for the "Event Streaming" leg of the Queue category (§3.7 / ADR-TSR-007) — it is recorded as a separate ADR here only because the task brief and master TSR §3.8 list it as its own category.

**Decision:** Adopt **NATS JetStream** as the Event Bus. Kafka is evaluated and explicitly documented as the pre-planned scale-up migration path, not adopted at this stage. RabbitMQ is evaluated and not recommended for this role.

**Consequences:**

- The platform operates a single binary (NATS Server with JetStream enabled) with no external coordination service, materially lowering the operational floor versus Kafka for a small-to-mid-size early engineering team.
- JetStream's native subject hierarchy is used for per-tenant event isolation and Architecture ADR-011's fair-share consumption pattern.
- The platform accepts a lower proven ceiling at true hyperscale event volumes than Kafka offers, a deliberate trade-off given AOS's actual near-term multi-tenant-SaaS scale target rather than an internet-hyperscale event-firehose target.
- A Kafka migration is pre-planned with a named trigger condition (sustained event throughput or consumer-group/partition complexity exceeding JetStream's comfortable operating envelope) and a defined incremental migration approach, so the eventual transition is deliberate rather than a reactive emergency (Risk Register RISK-003).
- JetStream's built-in KV/Object store is available as a secondary benefit for Registry caching needs, not itself the primary justification for the decision.

**Alternatives Considered:**

- **Kafka** — rejected as the _starting_ technology: its historical ZooKeeper dependency (reduced but not eliminated under KRaft mode) and generally heavier minimum operational footprint exceed what AOS's actual near-term event volume justifies. Not rejected outright — explicitly retained as the documented migration path once event volume genuinely demands its ceiling and ecosystem depth (schema registry, Kafka Connect, the industry's widest consumer-group tooling landscape).
- **RabbitMQ** — rejected: its AMQP exchange/queue model is a structurally worse fit for the event-sourced, replayable-log semantics Architecture ADR-001 requires than JetStream's native stream-log model. Remains a credible fallback only in the presence of strong pre-existing RabbitMQ operational expertise on the team, per `tech-stack/queue.md` §20.
