# Event Contract

**Contract ID:** `contract.event`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every fact published to the Event Bus per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §14 (Event Standards) and RULE-034 through RULE-037, instantiated as the `Event` cross-cutting concept and the 138-event catalog in [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §9 and §12, and hosted by the Event Driven Architecture in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §16.
**Schema files:** [`event.schema.yaml`](../schemas/event.schema.yaml), [`event.schema.json`](../schemas/event.schema.json)
**Examples:** [`event.valid.json`](../examples/event.valid.json), [`event.invalid.json`](../examples/event.invalid.json)
**Validation Rules:** [`event.validation.md`](../validation/event.validation.md) (VAL-097 – VAL-108)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of the Event envelope — the sole mechanism for cross-Bounded-Context, asynchronous communication (Architecture §16, ADR-001). It does not define any single event's business payload shape (that is `payload_schema`'s job, versioned per event); it defines the mandatory envelope every one of the 138 catalog events (DDD §12) and every future event MUST carry so that tracing, idempotent consumption, and dead-letter recovery are guaranteed platform-wide, not opt-in per producer.

## 2. Field Specification

| Field            | Type                                                              | Required | Description                                                                                        | Governing RULE / Section                    |
| ---------------- | ----------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `event_id`       | UUID                                                              | Yes      | Globally unique identifier for this specific event occurrence, used for consumer dedup             | RULE-037                                    |
| `event_name`     | string (`^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$`)                      | Yes      | Past-tense fact name, `<domain>.<entity>_<past_tense_verb>` (e.g. `lead.hot`, `sales.spk_created`) | Constitution §6.4, §14.2                    |
| `schema_version` | semver string                                                     | Yes      | Version of `payload_schema` this event instance conforms to                                        | RULE-035                                    |
| `publisher`      | string (Agent/Service code)                                       | Yes      | The registered Agent or Service that published this event                                          | Architecture §16 Sequence                   |
| `subscriber`     | array\<string\> (Agent/Service codes)                             | Yes      | Registered consumers of this event at publish time (may be empty for a newly introduced event)     | Architecture §16                            |
| `payload_schema` | string ($ref pointer)                                             | Yes      | Pointer to the JSON Schema document governing `payload`'s shape at `schema_version`                | RULE-035                                    |
| `payload`        | object (free-form, validated externally against `payload_schema`) | No       | The event-specific business fact data                                                              | DDD §12 catalog                             |
| `priority`       | integer 1–10                                                      | Yes      | Event Bus / Queue delivery priority                                                                | Architecture §26 Queue Standards            |
| `retry`          | object (`max_attempts`, `backoff_strategy`, `backoff_base_ms`)    | Yes      | Consumer-side retry behavior on transient delivery/processing failure                              | RULE-039 pattern                            |
| `delay`          | duration (ISO 8601, e.g. `PT5M`)                                  | No       | Delivery delay for deferred/scheduled-style events                                                 | Architecture §26                            |
| `dead_letter`    | object (`enabled`, `queue_ref`, `max_retries`, `alert_required`)  | Yes      | Dead-letter routing configuration after retry exhaustion                                           | RULE-039, RULE-040                          |
| `schedule`       | object (`cron`, `timezone`)                                       | No       | Present only for periodic/batch-originated facts (e.g. nightly rollup completion)                  | Scheduler Contract                          |
| `trace_id`       | UUID                                                              | Yes      | End-to-end trace correlation identifier                                                            | RULE-034                                    |
| `correlation_id` | UUID                                                              | Yes      | Originating request/workflow correlation identifier                                                | RULE-034, §14.5                             |
| `tenant_id`      | UUID                                                              | Yes      | Tenant this event belongs to (partition key)                                                       | RULE-034, Architecture §16 Scaling Strategy |
| `timestamp`      | date-time                                                         | Yes      | When the fact actually occurred (`occurred_at`)                                                    | §14.1                                       |

## 3. Lifecycle

```
published ──delivered to each subscriber──▶ delivered ──consumer acknowledges──▶ acknowledged
delivered ──consumer processing fails──▶ retried (up to retry.max_attempts) ──succeeds──▶ acknowledged
retried ──retry.max_attempts exhausted──▶ dead_lettered ──operator replays──▶ published (new event_id)
```

`dead_lettered` events remain inspectable and replayable; they are never silently dropped (RULE-039).

## 4. Invariants

- `event_name` MUST match `^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$` and MUST be a past-tense fact, never an imperative command (Constitution §6.4, §14.2).
- Every event instance MUST carry non-null `trace_id`, `correlation_id`, and `tenant_id` (RULE-034).
- `payload_schema` changes MUST be additive-only within `schema_version`'s major component (new optional fields only); a breaking change requires a new major `schema_version`, published alongside the prior major version for a minimum 90-day dual-support window (RULE-035, Constitution §21/RULE-071 applied to events).
- Every consumer listed in `subscriber` MUST be idempotent, deduplicating by `event_id` (at-least-once delivery is assumed) (RULE-037).
- `retry.max_attempts > 0` REQUIRES `dead_letter.enabled = true`, so exhausted retries route to a DLQ rather than being dropped (RULE-039, RULE-040).

## 5. Relationship to Other Contracts

Every Agent Contract instance declares the events it may emit/consume via its `events.publishes` / `events.subscribes` arrays (Agent Contract §2), referencing `event_name` values defined here. `dead_letter` shares its DLQ mechanics with the Queue Contract (`dead_letter`, `visibility_timeout`). `schedule` overlaps with the Scheduler Contract for periodic-fact-originated events. `trace_id`/`correlation_id` propagate into the Logging Contract's `Trace`/`Span`/`CorrelationId` fields. Every published event is the sole input to the Analytics Contract's event-sourced warehouse ingestion (Architecture §22).
