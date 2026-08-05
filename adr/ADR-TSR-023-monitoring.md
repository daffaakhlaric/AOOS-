# ADR-TSR-023 — Monitoring: Grafana Stack

**Status:** Accepted

**Context:** Constitution §33 (Cost Optimization) requires infrastructure cost to scale predictably with tenant count rather than via metered per-signal SaaS pricing, and the Cost Model (`cost-analysis/cost-model-100-1000-10000-dealers.md`) shows AI inference already dominating spend at every scale tier — leaving limited budget headroom for a high-margin proprietary monitoring product once the platform reaches thousands of tenants and correspondingly many services/metrics/logs. Candidates evaluated: Grafana Stack (self-hosted or Grafana Cloud), Datadog, New Relic — distinct from, but built on top of, the OpenTelemetry instrumentation standard already decided in ADR-TSR-017 (Observability).

**Decision:** Adopt the **Grafana Stack** (self-hosted Prometheus/Loki/Tempo/Grafana, or Grafana Cloud as a managed middle-ground for a small early operations team) as the day-to-day operational monitoring product. Both **Datadog** and **New Relic** are acknowledged to offer superior out-of-box UX, APM auto-instrumentation polish, and incident-response tooling maturity — this is a genuine, named trade-off, not a dismissal of their quality — but their per-host/per-GB-ingested pricing models scale unfavorably against AOS's target of thousands of dealer tenants and correspondingly many services, consistent with Constitution §33.

**Consequences:** The platform's operations team owns the infrastructure cost and operational toil of running (or subscribing to a managed instance of) four LGTM-stack components, rather than paying a single vendor to absorb that operational burden. Because instrumentation is standardized on OpenTelemetry (ADR-TSR-017) rather than a vendor-specific SDK, this decision remains reversible without re-instrumenting application code — a future move to Datadog/New Relic, if the self-hosted ops toil is ever measured to exceed the licensing savings (see the explicit re-evaluation checkpoints named in `roadmap/technology-roadmap.md` Year 3), is a backend-routing change, not a rewrite.

**Alternatives Considered:**

- **Datadog** — rejected as the default on cost-at-scale grounds, explicitly flagged for re-evaluation at defined roadmap checkpoints (`cost-analysis/`, `roadmap/technology-roadmap.md`) rather than permanently ruled out.
- **New Relic** — rejected for the same cost-at-scale reasoning as Datadog; carries a similar re-evaluation flag.
- **Grafana Cloud (managed) as the sole recommendation instead of self-hosted** — not rejected, but positioned as a valid staged option for a small early team rather than the default end-state, since self-hosting is the more cost-durable choice once the operations team has the capacity to run it.
