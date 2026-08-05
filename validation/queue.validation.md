# Queue Contract — Validation Rules (VAL-109 – VAL-120)

Governs: [`queue.contract.md`](../contracts/queue.contract.md) · Schemas: [`queue.schema.yaml`](../schemas/queue.schema.yaml), [`queue.schema.json`](../schemas/queue.schema.json)

| ID      | Rule                                                                                                                                                                             | Severity | Governing Source      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------- |
| VAL-109 | `queue_name` MUST match `^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`, i.e. exactly three dot-separated segments `<tenant-scope>.<domain>.<purpose>`.                    | Blocking | Constitution §6.6     |
| VAL-110 | `fair_share` MUST be present and non-null regardless of `fifo.enabled`; per-tenant fair-share dispatch is mandatory even for strictly-ordered queues.                            | Blocking | Constitution RULE-019 |
| VAL-111 | `dead_letter` MUST be present with a non-empty `destination` before `state` may be set to `active`.                                                                              | Blocking | Constitution RULE-038 |
| VAL-112 | `dead_letter.max_retries_before_dlq` MUST be ≥ 1 and ≤ `retry.max_attempts` bound declared by the same queue.                                                                    | Blocking | Constitution §15.5    |
| VAL-113 | `retry.max_attempts` MUST be an integer between 0 and 20 inclusive.                                                                                                              | Blocking | Schema constraint     |
| VAL-114 | `visibility_timeout` MUST be strictly greater than `metadata.max_processing_time_ms`, when that metadata key is present.                                                         | Blocking | Queue Contract §4     |
| VAL-115 | `visibility_timeout` MUST match ISO 8601 duration pattern `^PT\d+[SM]$`.                                                                                                         | Blocking | Schema constraint     |
| VAL-116 | `throughput.max_messages_per_second` MUST be ≥ 0.1; a zero-throughput active queue is invalid.                                                                                   | Blocking | Queue Contract §4     |
| VAL-117 | `throughput.protected_resource` MUST be a non-empty identifier naming the downstream system being rate-protected.                                                                | Blocking | Constitution §15      |
| VAL-118 | If `retry.max_attempts` > 0, `idempotency_required` MUST be `true` (a retryable job without idempotency risks duplicate side effects).                                           | Blocking | Constitution RULE-038 |
| VAL-119 | `state` MUST be one of `draft`, `active`, `deprecated`, `retired`; transitions are governed exclusively by the Registry Contract, never mutated directly by producers/consumers. | Blocking | Constitution RULE-011 |
| VAL-120 | `priority` MUST be an integer between 1 and 10 inclusive.                                                                                                                        | Blocking | Schema constraint     |
