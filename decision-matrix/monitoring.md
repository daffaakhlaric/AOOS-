# Decision Matrix — Monitoring

**Category:** §3.23 of [`../docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**Full record:** [`../tech-stack/monitoring.md`](../tech-stack/monitoring.md)
**ADR:** [`../adr/ADR-TSR-023-monitoring.md`](../adr/ADR-TSR-023-monitoring.md)

## How to read this matrix

Every dimension is scored **1 (worst) – 5 (best)**, except two dimensions inverted so "5" always means "best for AOS":

- **Vendor Lock-in Risk** — **5 = lowest lock-in risk**, 1 = highest.
- **Estimated Cost** — **5 = cheapest at 10,000-dealer scale**, 1 = most expensive.

Scores reflect qualitative, documentation-stage judgment (no AOS-specific benchmark has been run), grounded in each product's documented pricing model and operational architecture. The **Weighted Total** row weights Estimated Cost far above its usual share across this TSR's matrices, because this category's Final Recommendation is explicitly, primarily a cost-at-scale argument (Constitution §33) rather than a capability argument — Datadog/New Relic are acknowledged as capability-superior on several dimensions, and the weighting is built to make that acknowledgment visible in the matrix rather than hidden by a decisive cost win alone.

## Scoring Matrix

| Dimension            | Weight   | Grafana Stack | Datadog  | New Relic |
| -------------------- | -------- | ------------- | -------- | --------- |
| Performance          | 6%       | 3             | 5        | 5         |
| Scalability          | 8%       | 4             | 5        | 5         |
| Reliability          | 8%       | 3             | 5        | 5         |
| Security             | 6%       | 4             | 4        | 4         |
| Maintainability      | 8%       | 2             | 5        | 5         |
| Developer Experience | 8%       | 3             | 5        | 5         |
| Ecosystem            | 6%       | 5             | 5        | 4         |
| Community Maturity   | 4%       | 5             | 4        | 4         |
| Licensing            | 5%       | 4             | 2        | 2         |
| Cloud Compatibility  | 5%       | 5             | 5        | 5         |
| Vendor Lock-in Risk  | 11%      | 5             | 2        | 2         |
| Estimated Cost       | 25%      | 5             | 1        | 1         |
| **Weighted Total**   | **100%** | **3.87**      | **3.83** | **3.72**  |

## Weight Justification

- **Estimated Cost (25%)** is the single highest weight assigned to any dimension across every decision matrix in this TSR batch — a direct, deliberate reflection of the master TSR's own framing that this category's recommendation "primarily [rests] on cost-at-scale grounds." The per-host/per-GB-ingested pricing pattern reasoned through in `tech-stack/monitoring.md` compounds with exactly AOS's two growth axes (service count, Agent-invocation-driven log/trace volume), making cost the load-bearing dimension for a platform whose guiding principle #1 (TSR §1) is multi-tenant cost efficiency over convenience.
- **Vendor Lock-in Risk (11%)** is weighted well above average because proprietary dashboard/query/alert-rule formats create a real, compounding switching cost the longer a team operates on either SaaS product — a risk that grows over time in a way flat capability scores don't capture.
- **Maintainability, Developer Experience, Scalability, Reliability (8% each)** are kept meaningfully weighted on purpose — this is where Datadog/New Relic's real advantages live, and the matrix is built to let those advantages nearly close the gap rather than be swamped entirely by the cost weighting, reflecting the master TSR's explicit "this is a real trade-off, not a dismissal" framing.
- **Performance, Security, Licensing, Cloud Compatibility, Community Maturity, Ecosystem (4–6% each)** are lower-weighted secondary dimensions where the three candidates are close enough that they are not the deciding factor either way.

## Result

Grafana Stack wins the weighted total, but narrowly (3.87 vs. 3.83 vs. 3.72) — a deliberately close result given the weighting above, illustrating the master TSR's own framing precisely: the cost advantage is real and decisive at scale, but not so overwhelming that Datadog/New Relic's operational-polish advantages are irrelevant. This closeness is the matrix's way of encoding the explicit, standing re-evaluation trigger named in the Final Recommendation (ops toil exceeding licensing savings) — a result this close is exactly the kind of decision that should be revisited with real data, not treated as permanently settled.
