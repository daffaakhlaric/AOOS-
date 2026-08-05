# Reflection Contract

**Contract ID:** `contract.reflection`
**Version:** 1.0.0
**Status:** Active
**Governs:** Post-action evaluation of every Agent task execution per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) RULE-083 (low-confidence escalation), instantiated as the Reflection step of the Plan→Execute→Reflect loop and the `ReflectionScoringService` Domain Service defined in [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §11, hosted by the Reflection Engine component of the AI Runtime Architecture in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §18.
**Schema files:** [`reflection.schema.yaml`](../schemas/reflection.schema.yaml), [`reflection.schema.json`](../schemas/reflection.schema.json)
**Examples:** [`reflection.valid.json`](../examples/reflection.valid.json), [`reflection.invalid.json`](../examples/reflection.invalid.json)
**Validation Rules:** [`reflection.validation.md`](../validation/reflection.validation.md) (VAL-061 – VAL-072)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of what a Reflection record _is_ — the mandatory post-action evaluation an Agent produces after every task execution, before the outcome is allowed to reach a downstream consumer unchecked. Any AI Runtime implementation MUST treat a completed Agent task without a corresponding valid Reflection record as incomplete (Architecture §18 Sequence: "Reflection Engine scores the outcome/confidence"). This contract is what operationalizes RULE-083's escalation mandate into a checkable artifact.

## 2. Field Specification

| Field                  | Type                                                                              | Required    | Description                                                                                                         | Governing RULE / Section                           |
| ---------------------- | --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `id`                   | UUID                                                                              | Yes         | Globally unique, immutable identifier for this Reflection record                                                    | RULE-011 (Registry identity pattern)               |
| `code`                 | string (`^[a-z][a-z0-9_]*$`)                                                      | Yes         | Machine-readable slug, referenced by `Agent.reflection`                                                             | Constitution §6.1                                  |
| `agent_id`             | string (Agent Contract `code` or `id`)                                            | Yes         | The Agent instance whose task execution is being reflected upon                                                     | Architecture §18                                   |
| `task_id`              | string                                                                            | Yes         | The Task/invocation this Reflection evaluates                                                                       | DDD §9 Task Entity                                 |
| `tenant_id`            | UUID                                                                              | Yes         | Tenant this Reflection belongs to (tenant isolation)                                                                | Constitution §13.2 (applied to Reflection outputs) |
| `version`              | semver string                                                                     | Yes         | Immutable per published Reflection record                                                                           | RULE-070                                           |
| `created_at`           | date-time                                                                         | Yes         | Timestamp the Reflection was produced                                                                               | §14.1 (event timestamp analog)                     |
| `task_review`          | object (`summary`, `expected_outcome`, `actual_outcome`, `evaluation_criteria[]`) | Yes         | Structured comparison of what was expected vs. what happened                                                        | Architecture §18 Sequence                          |
| `quality_score`        | number (0.0–1.0)                                                                  | Yes         | Confidence/quality of the outcome, the Confidence Score VO                                                          | DDD §10 Confidence Score VO                        |
| `confidence_threshold` | number (0.0–1.0)                                                                  | Yes         | The tenant/Agent-configured threshold `quality_score` is checked against                                            | RULE-083, Architecture §18 Best Practice           |
| `escalation`           | object (`triggered`, `reason`, `escalated_to`, `escalated_at`)                    | Yes         | Whether this Reflection triggered human escalation                                                                  | RULE-083                                           |
| `failure_analysis`     | object (`root_cause`, `category`, `evidence[]`, `severity`)                       | Conditional | Root-cause analysis; required when `quality_score` falls below the "needs_review" threshold                         | Architecture §18 Failure Scenario                  |
| `improvement_plan`     | object (`recommended_action`, `owner`, `target_date`)                             | No          | Concrete corrective/preventive action derived from `failure_analysis`                                               | Architecture §18 Best Practice                     |
| `learning`             | array\<object\> (`insight`, `applicability_scope`, `confidence`)                  | No          | Generalizable insights extracted from this task's outcome                                                           | DDD §11 ReflectionScoringService                   |
| `feedback`             | object (`source`, `rating`, `comments`)                                           | No          | Human or downstream-system feedback attached after the fact                                                         | Architecture §18                                   |
| `knowledge_update`     | object (`knowledge_id`, `update_type`, `proposed_content_ref`)                    | No          | Proposed update to a Knowledge Contract entry; consumed by the Knowledge Ingestion Pipeline, never applied directly | Knowledge Contract §4, Architecture §21            |
| `status`               | enum: `pending`\|`evaluated`\|`completed`\|`escalated`\|`rejected`\|`archived`    | Yes         | Lifecycle state of this Reflection record                                                                           | §3 Lifecycle                                       |
| `metadata`             | object (free-form key-value)                                                      | No          | Non-functional annotations                                                                                          | —                                                  |

## 3. Lifecycle

```
pending ──Executor completes task──▶ evaluated
evaluated ──quality_score ≥ confidence_threshold──▶ completed
evaluated ──quality_score < confidence_threshold──▶ escalated ──human review resolves──▶ completed | rejected
completed | rejected ──retention window elapses (Memory Contract retention_policy)──▶ archived
```

A Reflection record transitions `status` only through the Reflection Engine (Architecture §18); no downstream consumer may mutate `status` retroactively (mirrors Agent Contract's RULE-011 pattern).

## 4. Invariants

- `quality_score` and `confidence_threshold` MUST each be within `[0.0, 1.0]` (DDD §10 Confidence Score VO).
- `quality_score < confidence_threshold` MUST set `escalation.triggered = true` and `status = escalated`; it MUST NEVER result in `status = completed` — silent completion of a low-confidence decision is forbidden (RULE-083).
- `escalation.triggered = true` REQUIRES `escalation.escalated_to` to be present and non-empty.
- `failure_analysis` MUST be present whenever `status = escalated` or `quality_score` falls below the tenant-configured "needs_review" threshold (which MAY be stricter than `confidence_threshold`).
- `knowledge_update`, if present, MUST reference an existing Knowledge Contract instance by `knowledge_id` and MUST NOT mutate that instance's `version` directly — Knowledge Contract versioning is append-only (Knowledge Contract §4); this field only proposes a candidate update for the Knowledge Ingestion Pipeline to act on.

## 5. Relationship to Other Contracts

An Agent Contract instance references exactly one Reflection Contract configuration via its `reflection` field (Agent Contract §2); every task execution of that Agent produces one Reflection _record_ conforming to this contract. `knowledge_update` cross-references the Knowledge Contract by id but never embeds it inline. Escalations surface through the Event Contract (`ai_runtime.confidence_low`, `ai_runtime.agent_escalated`) and are traced via the Logging Contract's `trace_id`/`correlation_id`. Aggregate Reflection outcomes feed the Analytics Contract's `agent_confidence_avg` and `agent_success_rate` metrics.
