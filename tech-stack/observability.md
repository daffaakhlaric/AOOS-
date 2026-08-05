# Tech Stack Record — Observability

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.17
Mirrors scoring in: [`decision-matrix/observability.md`](../decision-matrix/observability.md)
Formal decision: [`adr/ADR-TSR-017-observability.md`](../adr/ADR-TSR-017-observability.md)

---

## 1. Objective

Choose the tracing/metrics/logging instrumentation stack satisfying Constitution §17 (traceable AI decisions) and §25 (per-tenant real-time observability), and Architecture §23 Monitoring Architecture, §24 Logging Architecture, §25 Security Architecture, matching the tracing recommendation already named in Architecture §38 Tech Stack Recommendation.

## 2. Requirements

- Vendor-neutral instrumentation so every Agent/Tool/Workflow/service emits traces, metrics, and logs the same way regardless of which backend ultimately stores them (avoids re-instrumentation risk called out in `migration/migration-and-upgrade-strategy.md` §2).
- Trace-log-metric correlation sufficient to reconstruct "why did the AI do this" per an incident or audit request, without replaying the LLM call (RULE-047).
- Per-tenant tagging on every signal (`tenant_id`, `trace_id`, emitting component ID per RULE-045) to support Architecture §12's per-tenant isolation and §23's per-tier SLO/burn-rate alerting.
- Cost structure bound to infrastructure, not per-GB-ingested/per-host metering, consistent with Constitution §33 Cost Optimization at thousands-of-tenants scale.
- Self-hostable, to avoid a metered SaaS observability bill compounding on top of the platform's own multi-tenant infrastructure cost.

## 3. Candidate Technologies

| Candidate                | Role                                                          | License                 |
| ------------------------ | ------------------------------------------------------------- | ----------------------- |
| **OpenTelemetry (OTel)** | Vendor-neutral instrumentation SDK/Collector standard         | Apache 2.0              |
| **Prometheus**           | Metrics backend                                               | Apache 2.0              |
| **Loki**                 | Log aggregation backend                                       | AGPL-3.0 (Grafana Labs) |
| **Tempo**                | Distributed tracing backend                                   | AGPL-3.0 (Grafana Labs) |
| **Grafana**              | Unified dashboard/query layer                                 | AGPL-3.0 (Grafana Labs) |
| Jaeger                   | Standalone distributed tracing backend (alternative to Tempo) | Apache 2.0              |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best), except "Vendor Lock-in Risk" and "Estimated Cost", scored 1 (best/lowest) – 5 (worst/highest). OpenTelemetry is evaluated as the instrumentation layer common to both stacks; Prometheus/Loki/Tempo/Grafana ("LGTM") is compared as a bundle against Jaeger as a standalone tracing-only alternative, since Jaeger does not compete on the metrics/logs axes.

| Dimension                                | OTel + LGTM (Prometheus/Loki/Tempo/Grafana) | Jaeger (standalone tracing, would still need separate metrics/logs stack) |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| Performance                              | 4                                           | 4                                                                         |
| Scalability                              | 4                                           | 4                                                                         |
| Reliability                              | 4                                           | 4                                                                         |
| Security                                 | 4                                           | 3                                                                         |
| Maintainability                          | 3                                           | 3                                                                         |
| Developer Experience                     | 4                                           | 3                                                                         |
| Ecosystem                                | 5                                           | 3                                                                         |
| Community Maturity                       | 5                                           | 4                                                                         |
| Licensing                                | 4                                           | 5                                                                         |
| Cloud Compatibility                      | 5                                           | 4                                                                         |
| Vendor Lock-in Risk (low=better)         | 1                                           | 2                                                                         |
| Estimated Cost at AOS Scale (low=better) | 2                                           | 2                                                                         |

Full weighted matrix: [`decision-matrix/observability.md`](../decision-matrix/observability.md).

## 5. Benchmark

Directionally, per widely-reported operator experience: Prometheus's pull-based scraping model comfortably handles tens of thousands of active time series per instance before requiring sharding/remote-write federation (e.g., Thanos/Mimir) — a scale AOS is not expected to approach until well past the 10,000-dealer tier given per-service (not per-tenant) metric cardinality design. Loki's index-light, label-based design keeps log storage cost sub-linear relative to full-text-indexed alternatives (e.g., Elasticsearch-backed logging), a widely cited trade-off in Loki's own design goals. Tempo's trace storage is object-storage-backed (compatible with the R2/S3/MinIO decision in §3.13), keeping trace retention cost low relative to a database-backed tracing store. These are stated as directional, industry-reported design characteristics, not measured AOS benchmarks.

## 6. Performance

OTel SDKs add a small, well-characterized per-call instrumentation overhead (span creation, context propagation) that is standard practice across the industry and is not a meaningful cost relative to an LLM inference call's own latency. The OTel Collector (deployed as a sidecar or per-node DaemonSet in Kubernetes) batches and exports signals asynchronously, keeping instrumentation off the request's synchronous critical path.

## 7. Scalability

Prometheus scales via federation/remote-write to a long-term-storage backend (e.g., Mimir or Thanos) if single-instance cardinality limits are approached — a well-documented upgrade path, not a redesign. Loki and Tempo are both designed for horizontally-scalable, object-storage-backed operation from the start (multi-tenant mode natively supported by both), directly compatible with AOS's own multi-tenant model. Grafana itself is stateless aside from its own configuration store, scaling by replica count.

## 8. Reliability

The LGTM stack's reliability is the platform's own responsibility (self-hosted), same trade-off pattern as Keycloak (§3.16) — mitigated by RISK-005 in `risk/risk-register.md`, which names the specific re-evaluation checkpoint (ops toil vs. licensing savings) rather than leaving it open-ended. Each LGTM component supports HA deployment (multi-replica Prometheus with remote-write dedup, Loki/Tempo's natively distributed multi-component architecture), consistent with Architecture §11's deployment redundancy principle.

## 9. Security

OTel Collector configuration supports TLS-secured signal export and can be configured to strip/redact sensitive attributes before export — this is the enforcement point that backs Architecture §24's PII Redaction Middleware requirement (RULE-046) for any signal that might otherwise carry sensitive data (e.g., a span attribute accidentally containing a customer message). Grafana's RBAC (org/folder/dashboard-level access control) supports scoping which internal AOS roles can view which tenants' data, relevant where dashboards surface per-tenant metrics (Architecture §23). Because this stack is entirely self-hosted, no telemetry data — which can be operationally sensitive (request patterns, error content, trace attributes) — ever leaves AOS's own infrastructure boundary, a meaningful security/compliance posture relative to a third-party SaaS observability vendor ingesting the same data.

## 10. Maintainability

Operating four components (Prometheus, Loki, Tempo, Grafana) plus the OTel Collector fleet is more infrastructure surface than a single managed SaaS agent, and is the primary trade-off this decision accepts (§18 below). Mitigated by all four sharing the Grafana Labs operational model and the kube-prometheus-stack/Grafana Helm charts' relatively standardized deployment pattern, and by OTel Collector configuration being centrally templated rather than per-service bespoke.

## 11. Developer Experience

OTel's SDK API is consistent across TypeScript, Go, and Python (all three AOS languages per §3.1), meaning a service written in any of the three gets the same instrumentation model — a meaningful DX win for the polyglot footprint RISK-012 already flags as a coordination risk. Grafana's unified query/dashboard layer across metrics (PromQL), logs (LogQL), and traces (TraceQL) — with native trace-to-log-to-metric correlation via exemplars and derived fields — gives engineers a single pane of glass during incident investigation, which is a materially better DX than switching between separate metrics/logs/tracing tools (e.g., Prometheus + a standalone Jaeger UI + a separate log viewer).

## 12. Ecosystem

OpenTelemetry is the industry-consolidated instrumentation standard (CNCF graduated project) with auto-instrumentation libraries for virtually every major framework/library AOS depends on (NestJS/Node.js, Go's net/http and gRPC, Python's common web/AI libraries), and every major observability backend (including Datadog and New Relic, §3.23's rejected alternatives) accepts OTel-formatted signals — which is precisely what keeps the platform free to change backends later without re-instrumenting (§18). Grafana's plugin ecosystem (data sources, panel types) is broad and actively maintained.

## 13. Community Maturity

OpenTelemetry is a CNCF graduated project with contributions from every major cloud/observability vendor — one of the most broadly adopted standards in the space. Prometheus is also CNCF graduated and the de facto metrics standard. Loki and Tempo are actively maintained Grafana Labs projects with large adopter bases, though each individually has a shorter track record than Prometheus. Jaeger (CNCF graduated) has strong community maturity as a tracing-only tool but was not selected because it does not extend to metrics/logs and lacks Tempo's native Grafana correlation.

## 14. Licensing

- **OpenTelemetry, Prometheus:** Apache 2.0 — fully permissive, no usage restriction.
- **Loki, Tempo, Grafana:** AGPL-3.0 (Grafana Labs' license as of their 2021 relicensing from Apache 2.0). AGPL's copyleft terms apply to modifications distributed or offered as a network service to third parties; this is not a concern for AOS's use, which is internal operational tooling consumed by AOS's own engineering team, not a redistributed or white-labeled product offered to AOS's own dealer tenants. This distinction is noted explicitly because AGPL is a materially different license posture than Apache 2.0 and should be tracked if AOS ever considered offering Grafana-based dashboards directly to dealer tenants as a product feature (in which case Grafana Enterprise or a differently-licensed alternative would need re-evaluation).
- **Jaeger:** Apache 2.0.

## 15. Cloud Compatibility

Every component in the LGTM stack runs on any Kubernetes cluster or VM, cloud-agnostic by design, consistent with the multi-cloud-friendly posture the master TSR applies throughout (e.g., §3.21 Terraform, §3.20 Kubernetes). Loki and Tempo's object-storage backends are S3-API-compatible, meaning they slot directly behind the same Cloudflare R2/S3/MinIO decision already made in §3.13, avoiding a second, separate object-storage dependency.

## 16. Vendor Lock-in

OpenTelemetry is specifically designed to eliminate backend lock-in — instrumentation code is written once against the OTel API, and the Collector's exporter configuration determines where signals go. This means AOS can point the same instrumented codebase at Grafana Cloud, Datadog, New Relic, or any other OTel-compatible backend by changing Collector configuration alone, not application code — this is the direct mechanism behind the Grafana-Stack-to-Datadog migration path documented in `migration/migration-and-upgrade-strategy.md` §2. This is the lowest-lock-in position of any category in this TSR by design, since the instrumentation standard itself is the anti-lock-in mechanism, independent of which backend (LGTM or otherwise) is chosen operationally.

## 17. Estimated Cost

Reference: `cost-analysis/cost-model-100-1000-10000-dealers.md` §9 (Observability/Monitoring line) and §11 (Consolidated Total). The cost model prices the LGTM stack as **self-hosted infrastructure cost** (compute + retention storage for metrics/logs/traces), explicitly distinguished from a per-signal metered SaaS cost:

| Scale          | Estimated LGTM infra cost/mo (`cost-analysis` §9) | Illustrative Datadog/New-Relic-equivalent metered cost pattern                                                                                                                                                 |
| -------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 dealers    | $300 – $600                                       | Per-host + per-GB-ingested pricing at this scale is comparable-to-somewhat-higher, not yet the disqualifying gap                                                                                               |
| 1,000 dealers  | $2,000 – $4,000                                   | Per-host/per-GB metering grows with service replica count and log/trace volume, both of which scale materially faster than dealer count at this tier per typical SaaS-observability list pricing patterns      |
| 10,000 dealers | $12,000 – $22,000                                 | Metered SaaS cost at this signal volume commonly reaches multiples of the self-hosted infra cost per widely discussed community cost comparisons, though exact figures are vendor- and configuration-dependent |

The gap widens with scale because SaaS observability pricing is typically metered on ingested volume (hosts, GB of logs, spans, custom metrics) which grows with service replica count and signal cardinality — both of which scale faster than dealer count as the platform's own microservice/Agent footprint grows — whereas the self-hosted LGTM stack's cost is bound to the infrastructure provisioned to run it, independent of a per-signal meter. This is the same "cost model shape" risk pattern as Authentication (§3.16) applied to a different resource axis (signal volume rather than seat count).

## 18. Pros

- Vendor-neutral instrumentation eliminates backend lock-in by design.
- Trace-log-metric correlation in one tool (Grafana) improves incident-response DX materially over disjoint tools.
- Cost bound to infrastructure, not metered per-signal, at multi-tenant scale.
- Object-storage-backed Loki/Tempo reuse the platform's existing R2/S3/MinIO decision.
- CNCF-graduated (OTel, Prometheus) or Grafana-Labs-maintained (Loki/Tempo/Grafana) — strong community backing reduces abandonment risk.

## 19. Cons

- Four self-hosted components (plus the Collector fleet) is meaningfully more operational surface than a single managed SaaS agent.
- Loki/Tempo/Grafana's AGPL-3.0 license requires tracking if AOS ever offers Grafana-based dashboards as a direct tenant-facing product feature.
- Datadog/New Relic's out-of-box UX, APM auto-instrumentation polish, and incident-response tooling (anomaly detection, deployment tracking) are genuinely more mature than Grafana Stack's equivalent features today.
- Requires deliberate cardinality/retention governance (metric label design, log/trace retention tiers) to keep self-hosted storage cost bounded — a discipline a metered SaaS product enforces implicitly via billing, but a self-hosted stack must enforce deliberately.

## 20. Trade-offs

Operating four LGTM components is more infrastructure than a single managed SaaS observability product, accepted for cost control at scale (§17, and the explicit cost-vs-Datadog/New-Relic comparison carried in §3.23 Monitoring) and because OpenTelemetry instrumentation keeps the platform free to switch backends later without re-instrumenting code — this is the master TSR's stated trade-off (§3.17), reproduced here verbatim in substance.

## 21. Final Recommendation

**OpenTelemetry** as the vendor-neutral instrumentation standard across every service (traces, metrics, logs all emitted via OTel SDKs/Collectors, matching Architecture §38's tracing recommendation), feeding a self-hostable **Grafana + Prometheus + Loki + Tempo ("LGTM") stack**. **Jaeger is not separately adopted** — Tempo's native Grafana integration and its ability to correlate traces with Loki logs and Prometheus metrics in one pane is the better-integrated choice for AOS's stack, even though Jaeger remains a fine standalone tracing backend on its own.

## 22. ADR Reference

[`adr/ADR-TSR-017-observability.md`](../adr/ADR-TSR-017-observability.md)

## 23. Migration Strategy

Per `migration/migration-and-upgrade-strategy.md` §2: if self-hosted ops toil (measured engineering hours) exceeds licensing savings at a given tenant scale, run Grafana Stack and Datadog/managed-alternative in parallel during a defined evaluation window, using OpenTelemetry's vendor-neutral instrumentation — since instrumentation is not backend-specific, this is a Collector exporter configuration/routing change, not a re-instrumentation project. Re-evaluation checkpoint: each cost-analysis tier (100/1,000/10,000 dealers), per RISK-005 in the risk register. Grafana Cloud (managed Grafana Labs hosting) is the named intermediate step before reverting to a fully proprietary SaaS alternative, preserving the LGTM query/dashboard model while offloading operational burden.

## 24. Future Consideration

- Long-term-storage federation (Mimir or Thanos in front of Prometheus) if single-instance metric cardinality approaches practical limits at very high tenant/service counts.
- Continuous profiling (e.g., Grafana Pyroscope) as an additional OTel-adjacent signal type, for deep performance investigation of Agent Runtime hot paths, once base observability is stable in production.
- Cost-anomaly-detection dashboards layered on top of the LGTM stack specifically for AI/LLM spend (tying into RISK-001's real-time cost anomaly detection requirement), reusing Grafana's alerting rather than a separate tool.
