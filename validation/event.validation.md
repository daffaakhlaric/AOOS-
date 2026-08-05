# Event Contract — Validation Rules (VAL-097 – VAL-108)

Governs: [`event.contract.md`](../contracts/event.contract.md) · Schemas: [`event.schema.yaml`](../schemas/event.schema.yaml), [`event.schema.json`](../schemas/event.schema.json)

| ID      | Rule                                                                                                                                                                          | Severity | Governing Source                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------- |
| VAL-097 | `event_name` MUST match `^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$` and MUST represent a past-tense fact, never an imperative command.                                                | Blocking | Constitution §6.4, §14.2        |
| VAL-098 | `trace_id`, `correlation_id`, and `tenant_id` MUST all be present and non-null UUIDs.                                                                                         | Blocking | Constitution RULE-034           |
| VAL-099 | `schema_version` MUST follow semver; MINOR/PATCH bumps to `payload_schema` MUST be additive-only (no removed/renamed required fields).                                        | Blocking | Constitution RULE-035           |
| VAL-100 | A MAJOR `schema_version` bump MUST NOT retire the prior major version's `payload_schema` until the 90-day dual-support window elapses.                                        | Blocking | RULE-035, RULE-071              |
| VAL-101 | `retry.max_attempts > 0` REQUIRES `dead_letter.enabled = true`.                                                                                                               | Blocking | Constitution RULE-039, RULE-040 |
| VAL-102 | `dead_letter.enabled = true` REQUIRES `dead_letter.queue_ref` to be a non-empty reference to a Queue Contract instance.                                                       | Blocking | Queue Contract §1               |
| VAL-103 | `priority` MUST be an integer between 1 and 10 inclusive.                                                                                                                     | Blocking | Schema constraint               |
| VAL-104 | Every entry in `subscriber` MUST reference an Agent/Service that is contractually declared idempotent (no fire-and-forget non-idempotent consumers).                          | Blocking | Constitution RULE-037           |
| VAL-105 | `delay`, if present, MUST be a valid ISO 8601 duration and MUST NOT exceed the target queue's `visibility_timeout`.                                                           | Blocking | Queue Contract cross-check      |
| VAL-106 | `schedule` MUST be present only when the event represents a periodic/batch-originated fact (e.g. `analytics.rollup_completed`); ad hoc domain events MUST NOT set `schedule`. | Warning  | Architecture §16 Best Practice  |
| VAL-107 | `publisher` MUST reference a registered Agent or Service code, never a raw free-text string.                                                                                  | Blocking | Registry Contract cross-check   |
| VAL-108 | `timestamp` MUST reflect the actual occurrence time (`occurred_at`), not the publish/enqueue time, when the two differ by more than 1 second.                                 | Warning  | Constitution §14.1              |
