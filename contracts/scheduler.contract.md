# Scheduler Contract

**Contract ID:** `contract.scheduler`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every time-based/recurring trigger defined per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §16 (Scheduler Standards), and provisioned by the Scheduler infrastructure defined in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §27 (Scheduler Architecture).
**Schema files:** [`scheduler.schema.yaml`](../schemas/scheduler.schema.yaml), [`scheduler.schema.json`](../schemas/scheduler.schema.json)
**Examples:** [`scheduler.valid.json`](../examples/scheduler.valid.json), [`scheduler.invalid.json`](../examples/scheduler.invalid.json)
**Validation Rules:** [`scheduler.validation.md`](../validation/scheduler.validation.md) (VAL-121 – VAL-132)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a Scheduled Job — a declarative, time-based trigger for an Agent or Workflow. All recurring triggers (campaign checks, follow-up reminders, nightly analytics rollups) MUST be declared against this contract in the Scheduler Registry, never as ad-hoc cron scattered across services (Constitution §16.1).

## 2. Field Specification

| Field                     | Type                                                              | Required    | Description                                                                        | Governing RULE / Section                |
| ------------------------- | ----------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| `id`                      | UUID                                                              | Yes         | Globally unique, immutable identifier assigned at first registration               | RULE-011                                |
| `job_name`                | string (`^[a-z][a-z0-9_.]*$`)                                     | Yes         | Machine-readable slug, unique per tenant scope                                     | Constitution §6.1                       |
| `version`                 | semver string                                                     | Yes         | Immutable per published version                                                    | RULE-070, RULE-011                      |
| `description`             | string                                                            | Yes         | What this job does and why it runs on this trigger                                 | §22 Documentation Standards             |
| `state`                   | enum: `draft`\|`active`\|`paused`\|`retired`                      | Yes         | Registry lifecycle state; `paused` is per-tenant (RULE-044)                        | §9.3                                    |
| `trigger_type`            | enum: `cron`\|`interval`\|`calendar`                              | Yes         | Selects exactly one of `cron`/`interval`/`calendar` as the active trigger          | Scheduler Contract §4                   |
| `cron`                    | string (5- or 6-field cron expression)                            | Conditional | Required and non-null only when `trigger_type = cron`                              | Architecture §27                        |
| `interval`                | object (`every`: integer, `unit`: enum)                           | Conditional | Required and non-null only when `trigger_type = interval`                          | Architecture §27                        |
| `calendar`                | object (`rrule`: string, `exceptions`: array\<date\>)             | Conditional | Required and non-null only when `trigger_type = calendar`                          | Architecture §27                        |
| `timezone`                | IANA timezone string (e.g. `Asia/Jakarta`)                        | Yes         | Trigger MUST evaluate in this timezone; MUST respect tenant/branch Working Hour VO | Constitution §16.2, DDD Working Hour VO |
| `misfire_policy`          | enum: `catch_up`\|`skip_if_missed`                                | Yes         | Behavior when a scheduled tick is missed (e.g., Scheduler downtime)                | RULE-044                                |
| `dependency`              | object (`depends_on`: array\<string\>, `mode`: enum `all`\|`any`) | No          | Other scheduled job/workflow IDs that must complete before this job fires          | Architecture §27                        |
| `priority`                | integer 1–10                                                      | Yes         | Relative dispatch priority against sibling jobs sharing scheduler capacity         | §15 Queue Standards (shared infra)      |
| `retry`                   | object (`max_attempts`, `backoff_strategy`, `backoff_base_ms`)    | Yes         | Retry behavior on trigger-to-execution failure                                     | RULE-049                                |
| `execution_sla`           | duration (ISO 8601, e.g. `PT5M`)                                  | Yes         | Maximum acceptable delay between scheduled tick and execution start                | §16.3                                   |
| `owner_ref`               | object (`type`: enum `agent`\|`workflow`, `id`: string)           | Yes         | The Agent or Workflow this scheduled job triggers                                  | §16.3                                   |
| `missed_run_alert_policy` | string (Alert Policy ref)                                         | Yes         | Alerting policy invoked when a run is missed or fails SLA                          | §16.3                                   |
| `tenant_scope`            | enum: `global`\|`tenant_override_allowed`\|`tenant_only`          | Yes         | Whether tenants may override this job's Registry entry                             | §9.5                                    |
| `owner`                   | string (team/individual identifier)                               | Yes         | Accountable engineering owner                                                      | §8.1                                    |
| `tags`                    | array\<string\>                                                   | No          | Free-form discovery labels                                                         | —                                       |
| `metadata`                | object (free-form key-value)                                      | No          | Non-functional annotations                                                         | —                                       |

## 3. Lifecycle

```
draft ──validate trigger + dependency graph──▶ active
active ──tenant pause request──▶ paused ──tenant resume──▶ active
active ──superseded by new version──▶ retired
```

A scheduled job's `state` transitions only through the Scheduler Registry entry (Registry Contract); `paused` MUST be settable per-tenant without affecting other tenants sharing the same `job_name` template (RULE-044).

## 4. Invariants

- Exactly one of `cron`, `interval`, `calendar` MUST be non-null, matching `trigger_type`; the other two MUST be null (mutually exclusive trigger types).
- `timezone` MUST be present and MUST resolve against the invoking tenant/branch's Working Hour Value Object before dispatch is permitted (Constitution §16.2, DDD Working Hour VO).
- `misfire_policy` MUST be one of `catch_up` or `skip_if_missed`; default Scheduler behavior is `catch_up` unless explicitly overridden (RULE-044, Architecture §27 Recovery Strategy).
- `dependency.depends_on`, when present, MUST NOT introduce a cycle across the scheduled-job/workflow dependency graph.
- `owner_ref` MUST resolve to an existing `active` Agent or Workflow Registry entry at the time this job transitions to `active`.

## 5. Relationship to Other Contracts

A Scheduler Contract instance is referenced BY the Agent Contract's `scheduler` field (when `execution_mode = scheduled`) and by the Workflow Contract for time-triggered workflow starts. `dependency` references other Scheduler Contract instances or Workflow Contract instances by stable ID. Every Scheduled Job is published through the Registry Contract and its missed-run alerts feed the Logging and Analytics Contracts (Constitution §21 Versioning Strategy).
