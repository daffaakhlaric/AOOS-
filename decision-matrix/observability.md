# Decision Matrix — Observability

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.17, §2 (Evaluation Methodology)
Full detail: [`tech-stack/observability.md`](../tech-stack/observability.md)

## How to read this matrix

Each dimension is scored **1 (worst) – 5 (best)**, except the two rows marked **(low = better)**, scored **1 (best/lowest) – 5 (worst/highest)**. OpenTelemetry-instrumented LGTM (Prometheus/Loki/Tempo/Grafana) is compared as a bundle against Jaeger as a standalone tracing-only alternative — Jaeger does not itself cover metrics/logs, so a Jaeger-based stack would still require a separate metrics/logs solution not reflected in this simplified two-column comparison. The **Weighted Total** row inverts the low-is-better rows (`6 − raw score`) before weighting, so all rows read "higher contributes positively" in the final total.

| Dimension                                             | Weight | OTel + LGTM | Jaeger (tracing-only) |
| ----------------------------------------------------- | ------ | ----------- | --------------------- |
| Performance                                           | 8%     | 4           | 4                     |
| Scalability                                           | 10%    | 4           | 4                     |
| Reliability                                           | 10%    | 4           | 4                     |
| Security                                              | 10%    | 4           | 3                     |
| Maintainability                                       | 10%    | 3           | 3                     |
| Developer Experience                                  | 12%    | 4           | 3                     |
| Ecosystem                                             | 10%    | 5           | 3                     |
| Community Maturity                                    | 8%     | 5           | 4                     |
| Licensing                                             | 5%     | 4           | 5                     |
| Cloud Compatibility                                   | 5%     | 5           | 4                     |
| Vendor Lock-in Risk (low=better)                      | 12%    | 1           | 2                     |
| Estimated Cost at AOS Scale (low=better)              | 10%    | 2           | 2                     |
| **Weighted Total** (0–5 scale, cost/lock-in inverted) | 100%   | **4.22**    | **3.64**              |

## Weight justification

- **Vendor Lock-in (12%) and Developer Experience (12%)** weighted highest — OpenTelemetry's entire value proposition to AOS is backend portability (directly enabling the Grafana-Stack-to-Datadog migration path named in `migration/migration-and-upgrade-strategy.md`), and the single-pane trace/log/metric correlation DX is the specific reason Tempo (not Jaeger) is adopted for tracing.
- **Ecosystem (10%), Scalability (10%), Reliability (10%), Security (10%), Maintainability (10%), Estimated Cost (10%)** weighted evenly at a solid baseline — all materially relevant to a platform-wide instrumentation layer touching every service.
- **Community Maturity (8%) and Performance (8%)** weighted slightly lower — every candidate here clears the bar; this is not the differentiating axis.
- **Licensing (5%) and Cloud Compatibility (5%)** weighted lowest — Apache 2.0 vs. AGPL-3.0 matters operationally (tracked in `tech-stack/observability.md` §14) but does not change the decision outcome for AOS's internal-tooling use case, and cloud compatibility is a non-issue for either candidate.

## Reading the result

The weighted total (4.22 vs. 3.64) is driven primarily by Ecosystem and Vendor Lock-in — OpenTelemetry's status as the industry-consolidated instrumentation standard, accepted by every major backend including the ones this TSR did not choose, is the single strongest argument for the decision, independent of any one backend's individual merits.
