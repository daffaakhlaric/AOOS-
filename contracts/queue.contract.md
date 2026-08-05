# Queue Contract

**Contract ID:** `contract.queue`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every durable async work queue defined per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §15 (Queue Standards), and provisioned by the Queue infrastructure defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §26 (Queue Architecture).
**Schema files:** [`queue.schema.yaml`](../schemas/queue.schema.yaml), [`queue.schema.json`](../schemas/queue.schema.json)
**Examples:** [`queue.valid.json`](../examples/queue.valid.json), [`queue.invalid.json`](../examples/queue.invalid.json)
**Validation Rules:** [`queue.validation.md`](../validation/queue.validation.md) (VAL-109 – VAL-120)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a Queue — the durable dispatch mechanism for all async work (tool execution, workflow steps, notifications) per Constitution §15.1. No async work may be dispatched via fire-and-forget in-process calls; every queue instance MUST be declared against this contract before any producer or consumer may bind to it (Constitution RULE-038).

## 2. Field Specification

| Field                  | Type                                                                    | Required | Description                                                                                                    | Governing RULE / Section    |
| ---------------------- | ----------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `id`                   | UUID                                                                    | Yes      | Globally unique, immutable identifier assigned at first registration                                           | RULE-011                    |
| `queue_name`           | string (`^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`)          | Yes      | Fully-qualified queue name, format `<tenant-scope>.<domain>.<purpose>`                                         | Constitution §6.6           |
| `version`              | semver string                                                           | Yes      | Immutable per published version                                                                                | RULE-070, RULE-011          |
| `description`          | string                                                                  | Yes      | What work this queue carries and which producers/consumers bind to it                                          | §22 Documentation Standards |
| `state`                | enum: `draft`\|`active`\|`deprecated`\|`retired`                        | Yes      | Registry lifecycle state                                                                                       | §9.3                        |
| `priority`             | integer 1–10                                                            | Yes      | Relative dispatch priority against sibling queues sharing infrastructure                                       | §15 Queue Standards         |
| `fifo`                 | object (`enabled`: boolean, `per_tenant_partition`: boolean)            | Yes      | Whether strict ordering is enforced, and whether ordering is scoped per-tenant                                 | Architecture §26            |
| `fair_share`           | object (`strategy`: enum, `max_share_percent`: number)                  | Yes      | Per-tenant fair-share dispatch behavior, mandatory even when `fifo.enabled = true`                             | RULE-019                    |
| `delay`                | object (`default_delay_seconds`, `max_delay_seconds`)                   | Yes      | Message visibility delay bounds                                                                                | Architecture §26            |
| `retry`                | object (`max_attempts`, `backoff_strategy`, `backoff_base_ms`)          | Yes      | Retry behavior on consumer failure before dead-lettering                                                       | RULE-038                    |
| `dead_letter`          | object (`destination`, `max_retries_before_dlq`, `alert_policy`)        | Yes      | Mandatory dead-letter routing; never silently dropped                                                          | RULE-038, §15.4             |
| `visibility_timeout`   | duration (ISO 8601, e.g. `PT60S`)                                       | Yes      | Time a message is invisible to other consumers after pickup; MUST exceed max expected consumer processing time | Architecture §26            |
| `throughput`           | object (`max_messages_per_second`, `burst_limit`, `protected_resource`) | Yes      | Rate limits protecting shared downstream infrastructure                                                        | RULE-026-style protection   |
| `idempotency_required` | boolean                                                                 | Yes      | Whether consumers MUST supply/honor an idempotency key (mandatory per RULE-038)                                | RULE-038, §14.7             |
| `tenant_scope`         | enum: `global`\|`tenant_override_allowed`\|`tenant_only`                | Yes      | Whether tenants may override this queue's Registry entry                                                       | §9.5                        |
| `owner`                | string (team/individual identifier)                                     | Yes      | Accountable owner                                                                                              | §8.1                        |
| `events`               | object (`publishes`: array\<string\>, `subscribes`: array\<string\>)    | No       | Domain Events this queue's lifecycle emits/consumes (e.g., `queue.job_dead_lettered`)                          | §14, Architecture §26       |
| `tags`                 | array\<string\>                                                         | No       | Free-form discovery labels                                                                                     | —                           |
| `metadata`             | object (free-form key-value)                                            | No       | Non-functional annotations                                                                                     | —                           |

## 3. Lifecycle

```
draft ──validate + capacity review──▶ active
active ──superseded by new version──▶ deprecated ──drain + deprecation window elapses──▶ retired
```

A Queue's `state` transitions only through the Queue Registry entry (Registry Contract); no producer or consumer may mutate `state` directly (RULE-011).

## 4. Invariants

- `queue_name` MUST follow `<tenant-scope>.<domain>.<purpose>` (Constitution §6.6); `tenant-scope` segment MUST be `global` or a resolvable tenant/plan-tier identifier.
- `fair_share` MUST be declared for every queue regardless of `fifo.enabled` — strict per-tenant ordering does not exempt a queue from fair-share enforcement across tenants (RULE-019).
- `dead_letter.destination` MUST be non-null before `state` can transition to `active` (RULE-038).
- `visibility_timeout` MUST be strictly greater than the declared maximum expected consumer processing time recorded in `metadata.max_processing_time_ms`, when present.
- `throughput.max_messages_per_second` MUST be set to protect any shared downstream resource this queue's consumers call (e.g., CRM API, WhatsApp Business API rate limits).
- `retry.max_attempts` reaching `dead_letter.max_retries_before_dlq` MUST route to `dead_letter.destination`; poison messages are quarantined automatically, never retried indefinitely (§15.5).

## 5. Relationship to Other Contracts

A Queue Contract instance is referenced by Agent Contract (`execution_mode = async`), Workflow Contract (step dispatch), and Tool Contract (tool invocation dispatch) instances by stable `queue_name`, never embedded inline. Every Queue is itself published through the Registry Contract (`registry_type = ToolRegistry`/`WorkflowRegistry` adjacent infrastructure entries) and its dead-letter alerts feed the Logging and Analytics Contracts (Constitution §21 Versioning Strategy).
