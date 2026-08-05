# Logging Contract

**Contract ID:** `contract.logging`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every structured log record emitted by any service, Agent, Tool, or Workflow, per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §17 (Logging Standards, RULE-045, RULE-046, RULE-047), architected in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §24 (Logging Architecture).
**Schema files:** [`logging.schema.yaml`](../schemas/logging.schema.yaml), [`logging.schema.json`](../schemas/logging.schema.json)
**Examples:** [`logging.valid.json`](../examples/logging.valid.json), [`logging.invalid.json`](../examples/logging.invalid.json)
**Validation Rules:** [`logging.validation.md`](../validation/logging.validation.md) (VAL-181 – VAL-192)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a single structured log record's shape _after_ the mandatory PII Redaction Middleware has processed it (Architecture §24). It exists so that any log line — regardless of emitting component — is queryable by `trace_id`, tenant-filterable, and sufficient on its own to reconstruct "why did the system/AI do this" without replaying the underlying call (Constitution RULE-047).

## 2. Field Specification

| Field                | Type                                                                                | Required | Description                                                                                                                                                                               | Governing RULE / Section     |
| -------------------- | ----------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `log_id`             | UUID                                                                                | Yes      | Unique identifier for this log record                                                                                                                                                     | —                            |
| `trace_id`           | UUID                                                                                | Yes      | Distributed trace correlation ID spanning the full cross-service/cross-plugin call chain                                                                                                  | RULE-045, Constitution §25.2 |
| `span_id`            | UUID                                                                                | Yes      | This log's position within the trace (single unit of work)                                                                                                                                | Constitution §25.2           |
| `correlation_id`     | UUID                                                                                | No       | Business-level correlation (e.g., a single Lead's end-to-end journey), distinct from the technical `trace_id`                                                                             | —                            |
| `tenant_id`          | string                                                                              | Yes      | Tenant this log record belongs to; mandatory on every log line, `"platform"` reserved for AOS-internal/global operations                                                                  | RULE-045                     |
| `emitting_component` | string                                                                              | Yes      | ID of the Agent/Tool/Workflow/service that emitted this record                                                                                                                            | RULE-045                     |
| `severity`           | enum: `DEBUG`\|`INFO`\|`WARN`\|`ERROR`\|`CRITICAL`                                  | Yes      | Log level per Constitution §17.3 semantics                                                                                                                                                | Constitution §17.3           |
| `timestamp`          | date-time (ISO 8601, UTC)                                                           | Yes      | Time the event occurred (not time shipped to log store)                                                                                                                                   | Constitution §17.1           |
| `message`            | string                                                                              | Yes      | Human-readable summary; never free-text concatenation of variable data (structured fields carry the data)                                                                                 | Constitution §17.1           |
| `context`            | object (`prompt_version`, `model`, `input_summary`, `output_summary`, `confidence`) | No       | AI-decision reconstruction context; REQUIRED when `emitting_component` is an Agent and the log records a model-backed decision                                                            | Constitution §17.4           |
| `metadata`           | object (free-form, post-redaction)                                                  | No       | Additional structured key-values; MUST NOT contain raw PII or secrets — redaction is enforced upstream by the Redaction Middleware, this field asserts the shape _after_ that enforcement | RULE-046                     |
| `pii_redacted`       | boolean                                                                             | Yes      | Asserts the Redaction Middleware has already processed this record                                                                                                                        | RULE-046, Architecture §24   |
| `alert_dispatched`   | boolean                                                                             | No       | Whether `severity = CRITICAL` has already triggered a paging/alerting event (cross-ref Health Contract)                                                                                   | Constitution §17.3           |
| `retention_class`    | enum: `standard`\|`extended_compliance`\|`ephemeral_debug`                          | Yes      | Drives the Retention Policy Engine's per-level, per-compliance retention window                                                                                                           | Constitution §17.5           |

## 3. Lifecycle

```
emitted (in-process) ──redaction middleware scrubs known-sensitive fields──▶ shipped
shipped ──ingested by Centralized Log Store──▶ retained (per retention_class)
retained ──retention window elapses──▶ purged
```

A log record is immutable from the moment it is `shipped`; no component may edit a previously shipped log record, only append corrective/follow-up records referencing the same `trace_id` (append-only, consistent with Constitution §1.9 "no silent failure").

## 4. Invariants

- `tenant_id` and `trace_id` MUST be present on every log record with no exception, including system/platform-level logs (`tenant_id = "platform"` for genuinely tenant-less operations) (RULE-045).
- `metadata` and `context` MUST NOT contain raw PII (phone, email, address, payment reference) in plaintext; `pii_redacted` MUST be `true` before a record may be shipped to the Centralized Log Store (RULE-046).
- `severity = CRITICAL` REQUIRES `alert_dispatched` to eventually be set `true`; a CRITICAL log with `alert_dispatched` still `false` past a bounded window is itself a monitoring anomaly (cross-ref Health Contract `recovery`).
- If `emitting_component` denotes an Agent and the record documents a model-backed decision, `context` MUST be present with at minimum `prompt_version`, `model`, and `confidence` populated (Constitution §17.4).
- `severity = DEBUG` records MUST carry `retention_class = ephemeral_debug` — debug logs are never retained under the standard or extended-compliance window.

## 5. Relationship to Other Contracts

The Logging Contract is the terminal sink for every Agent, Tool, and Workflow Contract instance's `logging` reference. `trace_id` is the same identifier declared on the Event Contract, allowing a single business transaction to be reconstructed across the Event Bus and the log store jointly. `severity = CRITICAL` records are the upstream trigger for the Health Contract's `recovery` remediation flow. The Analytics Contract's metrics are computed from Domain Events, never directly from log records, keeping the Logging and Analytics contracts deliberately decoupled per Architecture §22's "never a direct DB read-replica" principle.
