# Tech Stack Record — Monitoring

**Category:** §3.23 of [`004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**ADR Reference:** [`adr/ADR-TSR-023-monitoring.md`](../adr/ADR-TSR-023-monitoring.md)
**Decision Matrix:** [`decision-matrix/monitoring.md`](../decision-matrix/monitoring.md)
**Status:** ACTIVE — Final

---

## Objective

Choose the day-to-day operational monitoring product — dashboards, alerting, on-call incident response tooling — that operations/SRE staff actually use to watch the platform, distinct from (but built directly on top of) the vendor-neutral **Observability** instrumentation standard already decided in §3.17 (OpenTelemetry emitting traces/metrics/logs, consumed by a self-hostable Grafana + Prometheus + Loki + Tempo "LGTM" stack).

## Requirements

- Consume OpenTelemetry-standard signals natively (§3.17 is already binding — this category cannot re-litigate the instrumentation standard, only the product that visualizes/alerts on it).
- Cost structure that does not scale punitively with the platform's own growth axis (tenant count, service count, event/log volume) — Constitution §33 Cost Optimization is an explicit, named requirement for every category in this TSR, and monitoring/observability tooling is historically one of the categories most prone to runaway per-signal metered costs at multi-tenant SaaS scale.
- Unified correlation across metrics, logs, and traces in one query/dashboard surface, so an on-call engineer investigating a Hot Lead delivery failure or a Tool circuit-breaker trip (Tool Contract §12.5) can pivot from a metric spike to the relevant trace to the relevant log lines without switching products.
- Alerting integrated with the platform's on-call/incident workflow (paging, escalation) at a cost and operational-maturity level appropriate for a small early SRE team, without requiring that team to become distributed-systems-monitoring experts before the platform has any real production traffic.

## Candidate Technologies

- **Grafana Stack** (self-hosted LGTM, or Grafana Cloud as a managed middle-ground)
- **Datadog** (proprietary SaaS, full-stack APM/monitoring/log platform)
- **New Relic** (proprietary SaaS, comparable full-stack APM/monitoring/log platform)

## Evaluation Matrix

Scoring: 1 (worst) – 5 (best) for every dimension except **Vendor Lock-in Risk** (1 = highest lock-in risk, 5 = lowest) and **Estimated Cost** (1 = most expensive at 10,000-dealer scale, 5 = cheapest).

| Dimension                                    | Grafana Stack                          | Datadog                   | New Relic              |
| -------------------------------------------- | -------------------------------------- | ------------------------- | ---------------------- |
| Performance (query latency at scale)         | 3 (tuning required)                    | 5 (managed, optimized)    | 5 (managed, optimized) |
| Scalability (multi-tenant, high cardinality) | 4 (with investment)                    | 5                         | 5                      |
| Reliability                                  | 3 (self-operated HA)                   | 5 (vendor SLA)            | 5 (vendor SLA)         |
| Security                                     | 4                                      | 4                         | 4                      |
| Maintainability                              | 2 (real ops burden)                    | 5                         | 5                      |
| Developer Experience                         | 3                                      | 5 (best-in-class polish)  | 5                      |
| Ecosystem (integrations, exporters)          | 5 (OTel-native, huge plugin ecosystem) | 5                         | 4                      |
| Community Maturity                           | 5                                      | 4 (large but proprietary) | 4                      |
| Licensing                                    | 4 (AGPL core, see below)               | 2 (proprietary)           | 2 (proprietary)        |
| Cloud Compatibility                          | 5                                      | 5                         | 5                      |
| Vendor Lock-in Risk                          | 5                                      | 2                         | 2                      |
| Estimated Cost (at 10,000-dealer scale)      | **5**                                  | **1**                     | **1**                  |

**Reading the DX/Reliability rows:** Datadog and New Relic score higher than Grafana Stack on Performance, Reliability, Maintainability, and Developer Experience — this is a real, acknowledged trade-off, not an oversight. The Final Recommendation is driven overwhelmingly by the Estimated Cost row's divergence at scale, which is large enough to outweigh the operational-polish gap for a platform whose entire selection philosophy (TSR §1, guiding principle #1) explicitly ranks multi-tenant cost efficiency above single-dimension convenience.

## Benchmark

No AOS-specific benchmark has been run (pre-implementation decision record). Directionally: Prometheus's local TSDB comfortably handles millions of active time series on well-provisioned hardware per widely reported community operating experience, and Loki/Tempo's index-light designs (log-line and trace-ID indexing rather than full-text indexing of every field) are specifically architected for cost-efficient operation at high log/trace volume — this is a deliberate design trade against Elasticsearch-style full-text log indexing (the same category of trade-off already made in §3.14's Meilisearch-over-Elasticsearch reasoning), accepting somewhat less flexible ad-hoc query power in exchange for materially lower storage/compute cost per ingested GB.

## Performance

Prometheus/Loki/Tempo query performance is a function of retention window, cardinality discipline, and hardware provisioning — all levers AOS's own SRE team controls directly. Datadog and New Relic's managed backends are professionally tuned by the vendor and require no equivalent in-house tuning effort, a real performance-with-less-effort advantage acknowledged in the matrix above.

## Scalability

The LGTM stack scales horizontally (Prometheus via remote-write federation/Thanos-class long-term-storage extensions if needed, Loki and Tempo are natively horizontally scalable microservices-mode deployments) — this is proven at large-scale production use elsewhere in the industry, but does require deliberate scaling architecture decisions as AOS grows (single-binary mode is adequate at 100-dealer scale; microservices mode becomes necessary well before 10,000-dealer scale). Datadog/New Relic's scaling is entirely the vendor's problem, not AOS's.

## Reliability

Self-hosting the LGTM stack means the platform owns its own HA story for monitoring infrastructure — a nontrivial irony risk (RISK-005 in `risk/risk-register.md`: monitoring the platform's reliability, itself needing to be reliable) that Datadog/New Relic's vendor-SLA model avoids entirely. This is the most legitimate reliability argument for the SaaS alternatives and is why Grafana Cloud (a managed middle-ground, see Final Recommendation) exists as a deliberate hedge rather than forcing every team straight into full self-hosted operation.

## Security

All three options support role-based dashboard access, audit logging of configuration changes, and encrypted transport for signal ingestion. Self-hosting Grafana Stack keeps all observability data (which can include PII in log lines if redaction discipline lapses — Tool Contract `telemetry.pii_redaction` field exists precisely to police this) within AOS's own infrastructure boundary; sending the same data to Datadog/New Relic means a third-party SaaS vendor holds a copy of AOS's operational data, a data-residency and third-party-exposure consideration relevant to Constitution §20 for any tenant with strict data-residency requirements.

## Maintainability

This is the LGTM stack's weakest dimension relative to the SaaS alternatives, and it is named explicitly as RISK-005 in the risk register: self-hosted ops burden could exceed licensing savings at some scale, which is exactly why this TSR names an explicit re-evaluation checkpoint (see Final Recommendation and Future Consideration) rather than treating the cost argument as permanently settled.

## Developer Experience

Datadog in particular is widely regarded as having the most polished out-of-box APM auto-instrumentation, one-click integrations, and incident-response UX of any monitoring product on the market — the master TSR explicitly acknowledges this ("Datadog is acknowledged as having superior out-of-box UX, APM auto-instrumentation polish, and incident-response tooling — this is a real trade-off, not a dismissal"). Grafana's UX has improved substantially in recent years but still generally requires more manual dashboard/alert-rule authoring than Datadog's auto-generated service maps and out-of-box dashboards.

## Ecosystem

Because §3.17 already commits the platform to OpenTelemetry as the vendor-neutral instrumentation layer, the Grafana Stack's "ecosystem" here is really OpenTelemetry's ecosystem — which is enormous, vendor-neutral by design, and growing faster than any single vendor's proprietary agent ecosystem. Datadog and New Relic both also accept OTel-formatted signals (both have invested in OTel compatibility as the industry standard has shifted), meaning the ecosystem dimension is closer between the three than it would have been years ago, before OTel's dominance — but choosing Grafana Stack means AOS's own instrumentation code never needs vendor-specific SDKs at all, further reducing switching friction either direction.

## Community Maturity

Grafana Labs (Prometheus since 2012 under CNCF, Grafana itself since 2014, Loki/Tempo newer but Grafana-Labs-backed) has deep, CNCF-graduated-project-level community maturity for the core components. Datadog and New Relic are large, mature companies with correspondingly large user bases, but as proprietary products their "community" is customer-support-and-documentation-driven rather than open-source-contributor-driven.

## Licensing

**Grafana** itself is **AGPLv3-licensed** (Grafana Labs's own license choice, not a third-party relicensing event); **Prometheus** is **Apache 2.0**; **Loki and Tempo** are **AGPLv3** (as of Grafana Labs's 2021 relicensing of those specific components from Apache 2.0). AGPLv3's copyleft terms are a genuine consideration for any organization that modifies and redistributes these components as a hosted product to third parties — not a practical restriction on AOS's use case of running Grafana Stack internally to monitor its own infrastructure (AGPL's network-copyleft clause is triggered by distributing a modified version as a service to others, not by internal operational use), but worth naming precisely rather than glossing over, consistent with this TSR's general practice of stating license types explicitly (Redis→Valkey in §3.6, Elasticsearch→OpenSearch in §3.14). **Datadog and New Relic** are both fully proprietary SaaS products under standard commercial terms.

## Cloud Compatibility

All three run/integrate identically across any cloud AOS operates in; the LGTM stack additionally runs identically on-prem for Enterprise tenants with data-residency requirements (same MinIO/Vault-class self-hosting advantage), which neither Datadog nor New Relic can offer as a genuinely on-prem-deployable option.

## Vendor Lock-in

This is one of the starkest differentiators in the matrix. Datadog and New Relic both use proprietary query languages, dashboard formats, and alerting-rule formats that do not port to each other or to Grafana Stack without a rewrite — a real, material lock-in cost once a large body of dashboards/alerts/runbooks accumulates. Because §3.17 already mandates OpenTelemetry as the instrumentation standard regardless of which visualization backend is chosen, AOS's actual _instrumentation code_ is never locked to any of the three — only the dashboards/alert-rules layer would need to be rebuilt in a future switch, which is exactly the property the `migration/migration-and-upgrade-strategy.md` Grafana Stack ↔ Datadog migration path relies on ("since instrumentation is not backend-specific, this is a configuration/routing change, not a re-instrumentation project").

## Estimated Cost

This is the decisive dimension for this category, and the master TSR is explicit that it is a cost-at-scale argument, not a quality argument. The reasoning, made concrete:

**The pricing pattern.** Datadog and New Relic both price primarily on **per-host** (APM/infrastructure monitoring) and **per-GB-ingested** (logs) metered dimensions — published list pricing patterns for both vendors, as of this writing, put per-host APM pricing in the range of roughly $15–$40/host/month depending on tier and commitment, and log ingestion in the range of roughly $0.10–$0.25+/GB ingested depending on retention/tier, before volume discounts. Both numbers compound multiplicatively against exactly the two axes this platform is built to grow on: **host/service count** (Kubernetes pods across NestJS Core Runtime services, Go perf-critical services, and Python AI/data tooling — Architecture's own many-small-services model, §3.1) and **log/trace volume** (which scales with tenant count and Agent-invocation volume — the same volume driver behind the AI/LLM Inference cost line in `cost-analysis/cost-model-100-1000-10000-dealers.md` §2, roughly 600K Agent invocations/mo at 100 dealers scaling to ~60M/mo at 10,000 dealers, each invocation producing trace spans and log lines).

**Concretely, at illustrative host counts:** a 100-dealer deployment (per the cost model's Compute Infrastructure line, "modest replica counts per service") might run on the order of dozens of monitored hosts/pods; a 10,000-dealer deployment (per the same line, "large multi-region node pools") might run several hundred to low thousands of monitored hosts/pods. At even a conservative ~$20/host/month blended APM rate, a few-hundred-host fleet alone is on the order of several-thousand-to-tens-of-thousands of dollars per month in APM licensing *before* log ingestion is counted — and log ingestion volume at AOS's Agent-invocation scale (tens of millions of invocations/month at 10,000-dealer scale, each contributing trace spans and log lines) plausibly reaches multi-terabyte-per-month ingestion, which at $0.10–$0.25/GB becomes another five-to-six-figure monthly line on its own. These are illustrative, order-of-magnitude figures from published list-pricing _patterns_, not a vendor quote (consistent with this TSR's stated non-fabrication standard) — but the multiplicative structure (per-host × host-count-that-grows-with-tenants) plus (per-GB × log-volume-that-grows-with-Agent-invocations) is the load-bearing point, and it scales in lockstep with exactly the two variables AOS's own growth model is built around.

**The Grafana Stack alternative.** Self-hosted LGTM cost is **infrastructure-bound, not metered-per-signal** — it is the compute/storage cost of running Prometheus/Loki/Tempo/Grafana pods and their retention volumes, which scales with the same host/log-volume growth but at raw infrastructure unit cost (compute + block storage pricing) rather than a vendor's per-host/per-GB _margin_ stacked on top of that same underlying infrastructure cost. This is precisely the number already reflected in the cost model's dedicated Observability line: **$300–$600/mo at 100 dealers, $2,000–$4,000/mo at 1,000 dealers, $12,000–$22,000/mo at 10,000 dealers** (`cost-analysis/cost-model-100-1000-10000-dealers.md` §9, §11) — an order of magnitude below the illustrative Datadog/New Relic APM-plus-log-ingestion figures reasoned through above at the same 10,000-dealer tier, even before accounting for the fact that the cost-model figure already assumes retention/storage at a level appropriate for production operations.

**Grafana Cloud** (the managed middle-ground) prices closer to a hybrid model (generous free/low-cost tiers scaling to metered usage-based pricing at higher volume) — cheaper in absolute terms than Datadog/New Relic at comparable ingestion volume per most published comparisons, though not as cheap as fully self-hosted infrastructure-bound cost; it exists specifically as the "smaller ops team, not ready for full self-hosting, but still cost-conscious" middle tier named in the Final Recommendation and Migration Strategy below.

## Pros

**Grafana Stack:** cost scales with infrastructure, not per-signal metering — the single largest advantage at AOS's target multi-tenant scale; OpenTelemetry-native, zero vendor lock-in on the instrumentation layer; on-prem deployable for data-residency-constrained tenants; large open-source community.
**Datadog / New Relic:** best-in-class out-of-box UX and APM auto-instrumentation polish; fully managed (no self-operated HA burden); vendor SLA-backed reliability; superior incident-response tooling maturity.

## Cons

**Grafana Stack:** real, ongoing self-hosting operational burden (RISK-005); requires deliberate cardinality/retention discipline to avoid its own cost/performance problems at scale; dashboard/alert authoring UX still trails Datadog's auto-generated polish.
**Datadog / New Relic:** per-host/per-GB pricing model that compounds badly against AOS's exact two growth axes (service/host count and Agent-invocation-driven log/trace volume), as reasoned above; proprietary dashboard/query formats create real lock-in once adopted at scale; third-party vendor holds a copy of AOS's operational (and potentially PII-adjacent, absent careful redaction) telemetry data.

## Trade-offs

Choosing Grafana Stack accepts a real, named operational burden (self-hosted HA, cardinality/retention tuning, less polished out-of-box UX) in exchange for a cost structure that scales sublinearly relative to Datadog/New Relic's metered pricing at AOS's target scale — directly consistent with TSR §1's guiding principle #1 ("multi-tenant cost efficiency wins over raw peak performance/convenience"). This is explicitly not a dismissal of Datadog/New Relic's real strengths; the master TSR names a standing re-evaluation trigger (ops toil exceeding licensing savings) precisely because the trade-off is a real one that could tip the other way at a given scale or team-maturity point, not a permanently settled question.

## Final Recommendation

**Grafana Stack** (self-hosted, or **Grafana Cloud** as a managed middle-ground for a small early ops team) — matching TSR §3.23 exactly, primarily on cost-at-scale grounds reasoned through concretely above: Datadog and New Relic's per-host/per-GB-ingested pricing models become materially expensive at the thousands-of-tenant, many-services scale AOS targets (Constitution §33 Cost Optimization), whereas the self-hosted LGTM stack's cost is infrastructure-bound rather than metered-per-signal. **Datadog is acknowledged as having superior out-of-box UX, APM auto-instrumentation polish, and incident-response tooling** — this is a real trade-off, not a dismissal, and is explicitly flagged for re-evaluation if the ops team's toil from self-hosting Grafana Stack exceeds the licensing savings at a given tenant scale.

## ADR Reference

[`adr/ADR-TSR-023-monitoring.md`](../adr/ADR-TSR-023-monitoring.md)

## Migration Strategy

Per `migration/migration-and-upgrade-strategy.md`: **Grafana Stack (self-hosted) → Datadog / managed alternative**, triggered when self-hosted ops toil (measured engineering hours) exceeds licensing savings at a given tenant scale (TSR §5, §3.23) — evaluated using real data at each cost-analysis checkpoint (100/1,000/10,000-dealer tiers), not a priori. Because OpenTelemetry instrumentation (§3.17) is already vendor-neutral, this migration is a backend-routing/configuration change (point the OTel Collector's exporter at Datadog's ingestion endpoint instead of the self-hosted LGTM stack) rather than a re-instrumentation project — the lowest-friction migration path in this entire TSR precisely because the instrumentation-standard decision (§3.17) was deliberately made independent of this visualization-product decision. **Grafana Cloud** is the intermediate step recommended before a full Datadog/New Relic move: it removes the self-hosting HA burden while retaining Grafana's dashboard/alerting format (zero rework) and OTel-native ingestion, letting the team isolate whether the pain point was "self-hosting operations" (solved by Grafana Cloud) or "Grafana's UX/tooling itself" (which would still argue for Datadog) before committing to the higher-cost, higher-lock-in move.

## Future Consideration

Explicit re-evaluation checkpoint at each cost-analysis tier (100/1,000/10,000-dealer, per `cost-analysis/cost-model-100-1000-10000-dealers.md` §12 Recommended Cost Governance Actions), using real measured ops-toil hours against real measured licensing-savings dollars, not the illustrative reasoning in this document. Track Grafana's own APM/UX polish investment over time (Grafana Labs has been actively closing the auto-instrumentation gap with Datadog) as a factor that could reduce the DX trade-off's weight at the next checkpoint.
