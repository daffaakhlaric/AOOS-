# Analytics Contract

**Contract ID:** `contract.analytics`
**Version:** 1.0.0
**Status:** Active
**Governs:** Every named Metric surfaced by the Analytics Warehouse and Metrics Semantic Layer, per [`001-ENGINEERING-CONSTITUTION.md`](../docs/001-ENGINEERING-CONSTITUTION.md) §25 (Monitoring Standards) and §26 (Performance Standards), architected in [`002-ENTERPRISE-ARCHITECTURE.md`](../docs/002-ENTERPRISE-ARCHITECTURE.md) §22 (Analytics Architecture), and formalizes the KPI Definitions of [`003-DOMAIN-DRIVEN-DESIGN.md`](../docs/003-DOMAIN-DRIVEN-DESIGN.md) §28 and the Reporting Model of §29.
**Schema files:** [`analytics.schema.yaml`](../schemas/analytics.schema.yaml), [`analytics.schema.json`](../schemas/analytics.schema.json)
**Examples:** [`analytics.valid.json`](../examples/analytics.valid.json), [`analytics.invalid.json`](../examples/analytics.invalid.json)
**Validation Rules:** [`analytics.validation.md`](../validation/analytics.validation.md) (VAL-169 – VAL-180)

---

## 1. Purpose

This contract is the formal, implementation-independent specification of a single named Metric definition in the Metrics Semantic Layer (Architecture §22). It exists so that "cost per hot lead" or "campaign ROI" is defined exactly once, machine-readably, and every Dashboard, Agent, and scheduled report consumes the identical definition — preventing the metric-drift failure mode the Architecture explicitly warns against ("never let dashboards and Agents compute the same metric with divergent logic").

## 2. Field Specification

| Field             | Type                                                                          | Required | Description                                                                                                                                | Governing RULE / Section           |
| ----------------- | ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `id`              | UUID                                                                          | Yes      | Globally unique, immutable identifier for this Metric definition                                                                           | RULE-011                           |
| `metric`          | string (`^[a-z][a-z0-9_]*$`)                                                  | Yes      | Machine-readable metric name; SHOULD match a KPI name from DDD §28 catalog where one exists (e.g., `cost_per_hot_lead`)                    | DDD §28 KPI Definition             |
| `display_name`    | string                                                                        | Yes      | Human-readable label shown on dashboards                                                                                                   | —                                  |
| `definition`      | string                                                                        | Yes      | Precise formula/definition, matching the DDD §28 "Definition" column verbatim where the metric maps to a cataloged KPI                     | DDD §28                            |
| `domain`          | enum: `dealer`\|`sales`\|`campaign`\|`ads`\|`content`\|`ai_agent`\|`workflow` | Yes      | Business domain grouping, mirrors DDD §28 "Domain" column                                                                                  | DDD §28                            |
| `dimension`       | array\<string\>                                                               | Yes      | Attributes this metric can be sliced by; MUST include `tenant_id`                                                                          | DDD §25 Tenant Isolation           |
| `aggregation`     | enum: `sum`\|`avg`\|`count`\|`p50`\|`p95`\|`p99`\|`ratio`                     | Yes      | Aggregation function applied at rollup time                                                                                                | Constitution §25.1                 |
| `source_events`   | array\<string\> (Domain Event names)                                          | Yes      | Domain Events (DDD §12) this metric is computed from, ingested only via the Event Bus                                                      | Architecture §22, RULE-023         |
| `retention`       | object (`hot_days`, `cold_days`, `cold_tier`)                                 | Yes      | Hot/cold tiering of the underlying rolled-up data                                                                                          | Architecture §22 Scaling Strategy  |
| `sampling`        | object (`rate`, `strategy`)                                                   | No       | Sampling applied at ingestion for high-volume metrics (`strategy`: `none`\|`fixed_rate`\|`reservoir`)                                      | §26.4 Performance Standards        |
| `export`          | object (`destinations`, `tenant_isolation_required`)                          | Yes      | Allowed export destinations (`dashboard`, `warehouse`, `third_party_bi`) and whether cross-tenant aggregation is forbidden for this metric | DDD §25, Constitution §20.1        |
| `rollup_schedule` | string (cron or `PT`-duration)                                                | Yes      | Scheduler cadence (Architecture §22 "Aggregation/Rollup Jobs") that (re)computes this metric                                               | Architecture §22                   |
| `freshness_sla`   | duration (ISO 8601)                                                           | Yes      | Maximum staleness before dashboards must display a "data as of" freshness warning                                                          | Architecture §22 Recovery Strategy |
| `owner`           | string                                                                        | Yes      | Accountable team/individual for this metric's correctness                                                                                  | Constitution §22.1                 |
| `state`           | enum: `draft`\|`active`\|`deprecated`\|`retired`                              | Yes      | Registry lifecycle state                                                                                                                   | §9.3                               |
| `tags`            | array\<string\>                                                               | No       | Free-form discovery labels                                                                                                                 | —                                  |

## 3. Lifecycle

```
draft ──reviewed against DDD §28 catalog + validated source_events──▶ active
active ──superseded by a redefined metric──▶ deprecated ──dual-support window elapses──▶ retired
```

A Metric's `definition` and `aggregation` MUST NOT change in place once `active` (RULE-011); a redefinition publishes a new Metric and deprecates the old one, preserving historical dashboard/report reproducibility.

## 4. Invariants

- `dimension` MUST include `tenant_id` — every metric is tenant-taggable, with no exceptions (DDD §25).
- `source_events` MUST reference only Domain Events cataloged in DDD §12; a metric computed from a direct transactional-store read (bypassing the Event Bus) is a publish-blocking violation (RULE-023).
- `metric` that maps to a name in the DDD §28 KPI catalog MUST carry the identical `definition` text — no dashboard-specific reinterpretation.
- `export.destinations` containing `third_party_bi` REQUIRES `export.tenant_isolation_required = true` and an explicit per-tenant opt-in (Constitution §20.1).
- `retention.hot_days` MUST be less than or equal to `retention.cold_days`; cold-tier retention MUST NOT be shorter than hot-tier retention.
- `state = active` REQUIRES `rollup_schedule` and `freshness_sla` to both be non-null (a metric with no rollup cadence cannot be trusted as live).

## 5. Relationship to Other Contracts

Analytics Metric definitions are consumed by reference from an Agent Contract's `metrics` field, a Tool Contract's `metrics` field, and a Workflow Contract's `metrics` field — none of them embed metric logic inline. The Scheduler Contract governs `rollup_schedule` execution. The Event Contract is the sole ingestion path (`source_events`), and the Logging Contract's structured logs feed the raw signal these metrics aggregate over. The Health Contract's `error_rate`/`latency` fields are themselves specializations of Analytics metrics scoped to liveness rather than business outcome.
