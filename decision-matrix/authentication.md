# Decision Matrix — Authentication

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.16, §2 (Evaluation Methodology)
Full detail: [`tech-stack/authentication.md`](../tech-stack/authentication.md)

## How to read this matrix

Each dimension is scored **1 (worst) – 5 (best)**, except the two rows marked **(low = better)**, which are scored **1 (best/lowest) – 5 (worst/highest)** — i.e. a low number is the good outcome on those two rows only. This inversion exists because "Vendor Lock-in Risk" and "Estimated Cost" are risk/cost measures, not capability measures, and inverting them keeps every other row's "higher is better" reading intuitive. The **Weighted Total** row normalizes Lock-in and Cost back onto the same "higher is better" direction (`6 − raw score`) before applying weights, so the final weighted total is comparable across all rows on a single "higher is better" scale.

| Dimension                                             | Weight | Keycloak | Auth0    | Clerk    | Supabase Auth |
| ----------------------------------------------------- | ------ | -------- | -------- | -------- | ------------- |
| Performance                                           | 8%     | 4        | 4        | 4        | 3             |
| Scalability                                           | 10%    | 5        | 4        | 3        | 3             |
| Reliability                                           | 10%    | 4        | 5        | 4        | 4             |
| Security                                              | 15%    | 5        | 5        | 4        | 4             |
| Maintainability                                       | 8%     | 3        | 5        | 5        | 4             |
| Developer Experience                                  | 7%     | 3        | 5        | 5        | 5             |
| Ecosystem                                             | 5%     | 4        | 4        | 3        | 3             |
| Community Maturity                                    | 5%     | 5        | 5        | 3        | 3             |
| Licensing                                             | 7%     | 5        | 2        | 2        | 4             |
| Cloud Compatibility                                   | 5%     | 5        | 5        | 4        | 4             |
| Vendor Lock-in Risk (low=better)                      | 10%    | 1        | 5        | 5        | 4             |
| Estimated Cost at AOS Scale (low=better)              | 10%    | 2        | 5        | 4        | 3             |
| **Weighted Total** (0–5 scale, cost/lock-in inverted) | 100%   | **4.14** | **3.98** | **3.44** | **3.42**      |

## Weight justification

- **Security (15%) and Vendor Lock-in (10%) plus Estimated Cost (10%) = 35% combined** — the highest concentration of weight, because Authentication is a security-critical, cost-multiplied-by-seat-count Generic Domain (DDD §4) where the master TSR's stated deciding factor is explicitly cost-at-scale and lock-in avoidance (§3.16), not feature richness.
- **Scalability (10%) and Reliability (10%)** weighted above average because authentication sits on the critical path of every tenant's login and RISK-007 in `risk/risk-register.md` explicitly flags availability as High severity.
- **Developer Experience (7%) and Maintainability (8%)** weighted moderately — real considerations, but explicitly subordinate to cost/lock-in per the master doc's stated philosophy (§1, principle 2: "open, self-hostable... preferred... wherever the operational burden is acceptable").
- **Performance (8%), Ecosystem (5%), Community Maturity (5%), Licensing (7%), Cloud Compatibility (5%)** weighted lower — all meaningfully satisfied by every candidate in this table, so they are less differentiating for this specific decision.

## Reading the result

Keycloak's weighted total (4.14) edges out Auth0 (3.98) despite scoring lower on Reliability, Maintainability, and Developer Experience — because the heavily-weighted Security/Lock-in/Cost cluster swings decisively in Keycloak's favor at AOS's dealer-tenant scale. This mirrors, not overrides, the master TSR's qualitative §3.16 Final Recommendation — the matrix is a supporting artifact, not the source of the decision.
