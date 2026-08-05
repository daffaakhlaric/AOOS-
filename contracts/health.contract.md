# Health Contract

**Contract ID:** `contract.health`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every liveness/readiness/SLO configuration for a service, Agent, Tool, or Workflow, per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §25 (Monitoring Standards) and §24.3 (Deployment Standards liveness/readiness probes), architected in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §23 (Monitoring Architecture) and §24 (Deployment liveness/readiness context).
**Schema files:** [`health.schema.yaml`](../schemas/health.schema.yaml), [`health.schema.json`](../schemas/health.schema.json)
**Examples:** [`health.valid.json`](../examples/health.valid.json), [`health.invalid.json`](../examples/health.invalid.json)
**Validation Rules:** [`health.validation.md`](../validation/health.validation.md) (VAL-193 – VAL-204)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a component's health-check configuration — how it reports liveness, what its SLO target is, how its dependencies are checked, and how it recovers from a degraded state. Every Agent, Tool, and Workflow Contract instance references exactly one Health Contract instance; no component may be promoted to `active` in any Registry without one (Constitution §24.3, "orchestration never routes traffic to a not-ready instance").

## 2. Field Specification

| Field              | Type                                                                             | Required | Description                                                                                                                                        | Governing RULE / Section                                       |
| ------------------ | -------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `id`               | UUID                                                                             | Yes      | Globally unique identifier for this Health configuration                                                                                           | RULE-011                                                       |
| `component_ref`    | string                                                                           | Yes      | ID of the Agent/Tool/Workflow/service this Health configuration belongs to                                                                         | Architecture §23                                               |
| `heartbeat`        | object (`interval`, `timeout`)                                                   | Yes      | Liveness heartbeat cadence and the timeout after which a missed heartbeat is treated as unresponsive                                               | Constitution §24.3                                             |
| `availability`     | object (`slo_target`, `measurement_window`)                                      | Yes      | SLO target expressed as a percentage (e.g., `99.9`) over a measurement window, tied to Architecture §23 burn-rate alerting                         | Constitution §25.3, Architecture §23                           |
| `latency`          | object (`p50_ms`, `p95_ms`, `p99_ms`, `budget_ms`)                               | Yes      | Declared latency budget and observed percentile targets                                                                                            | Constitution §26.1                                             |
| `error_rate`       | object (`threshold_percent`, `measurement_window`)                               | Yes      | Error-rate SLO threshold that triggers burn-rate alerting                                                                                          | Constitution §25.1, §25.3                                      |
| `recovery`         | object (`mode`, `automatic_action`, `manual_runbook_ref`, `circuit_breaker_ref`) | Yes      | `mode`: `automatic`\|`manual`\|`hybrid`; automatic recovery links to the Tool Contract's `circuit_breaker` behavior where applicable               | Constitution §18.6, Tool Contract §2                           |
| `dependency_check` | array\<object\> (`dependency_id`, `dependency_type`, `health_ref`)               | Yes      | Enumerates downstream dependencies (Tool providers, LLM providers, DB) each carrying a reference to that dependency's own Health Contract instance | Architecture §23, §25 (Security Architecture dependency chain) |
| `readiness_gate`   | boolean                                                                          | Yes      | Whether orchestration MUST withhold traffic until this component reports ready (vs. liveness-only)                                                 | Constitution §24.3                                             |
| `dashboard_ref`    | string                                                                           | No       | Pointer to the Dashboard (Architecture §23) surfacing this component's health                                                                      | Constitution §25.4                                             |
| `state`            | enum: `healthy`\|`degraded`\|`unhealthy`\|`unknown`                              | Yes      | Current observed health state (last evaluated, not a static declaration)                                                                           | Architecture §23                                               |
| `last_evaluated`   | date-time (ISO 8601)                                                             | Yes      | Timestamp of the most recent health evaluation                                                                                                     | —                                                              |

## 3. Lifecycle

```
unknown ──first successful heartbeat + dependency_check pass──▶ healthy
healthy ──SLO burn-rate or dependency degradation──▶ degraded ──recovery.mode resolves──▶ healthy
degraded ──recovery fails / heartbeat.timeout exceeded──▶ unhealthy ──orchestration withholds traffic (readiness_gate)──▶ degraded/healthy
```

`state` is a continuously re-evaluated observation, not a Registry-managed lifecycle field like Agent `state`; it is written by the Monitoring pipeline (Architecture §23), never by the component itself self-declaring health.

## 4. Invariants

- `heartbeat.interval` MUST be strictly less than `heartbeat.timeout`; a component cannot declare a timeout shorter than its own reporting cadence.
- `availability.slo_target` MUST be expressed as a percentage between 0 and 100 exclusive of 0, tied to an automated burn-rate alert per Constitution §25.3 — an SLO with no alerting configuration is not a valid Health Contract instance.
- Every entry in `dependency_check` MUST carry a `health_ref` resolving to another valid Health Contract instance (or an external-provider stub Health instance for third-party dependencies like LLM/CRM/Ads providers).
- `recovery.mode = automatic` on a Tool-backed component REQUIRES `recovery.circuit_breaker_ref` to resolve to that Tool Contract instance's `circuit_breaker` configuration (Constitution §18.6).
- `readiness_gate = true` REQUIRES `latency.budget_ms` to be non-null — a gated component must have a declared latency budget so degraded-but-technically-alive instances are correctly excluded from traffic.
- `state = unhealthy` for longer than `heartbeat.timeout` × 3 without a corresponding CRITICAL Logging Contract record is a monitoring-pipeline integrity failure, not a valid steady state.

## 5. Relationship to Other Contracts

Every Agent, Tool, and Workflow Contract instance references exactly one Health Contract instance via its `health` field. `dependency_check` entries chain to other components' Health Contract instances, forming the full dependency health graph referenced in Architecture §23. `recovery.circuit_breaker_ref` cross-references the Tool Contract's `circuit_breaker` object. `state` transitions to `unhealthy`/`degraded` are mandatorily accompanied by a `severity = CRITICAL` or `ERROR` Logging Contract record, and feed the Analytics Contract's `ai_agent`/`workflow` domain metrics (e.g., `workflow_success_rate`) as a supporting signal.
