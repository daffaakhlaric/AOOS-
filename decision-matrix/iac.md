# Decision Matrix — Infrastructure as Code (IaC)

**Category:** §3.21 of [`../docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**Full record:** [`../tech-stack/iac.md`](../tech-stack/iac.md)
**ADR:** [`../adr/ADR-TSR-021-iac.md`](../adr/ADR-TSR-021-iac.md)

## How to read this matrix

Every dimension is scored **1 (worst) – 5 (best)**, except two dimensions where a low raw number is the _good_ outcome and is inverted before scoring so that "5" always means "best for AOS" consistently across the whole table:

- **Vendor Lock-in Risk** — scored so that **5 = lowest lock-in risk**, 1 = highest lock-in risk.
- **Estimated Cost** — scored so that **5 = cheapest at AOS's target scale**, 1 = most expensive.

Scores reflect qualitative, documentation-stage judgment (no AOS-specific benchmark has been run) grounded in each candidate's documented behavior and widely reported industry practice, per the TSR's evaluation methodology (§2 of the master document). The **Weighted Total** row is not a naive average — each dimension is weighted by how much it actually matters to AOS's specific requirements for this category (see weight justification below), then summed. A candidate can lose on raw dimension count and still win the weighted total if it wins the dimensions that matter most for AOS's use case.

## Scoring Matrix

| Dimension            | Weight   | Terraform | Pulumi   |
| -------------------- | -------- | --------- | -------- |
| Performance          | 5%       | 4         | 4        |
| Scalability          | 8%       | 5         | 4        |
| Reliability          | 8%       | 5         | 4        |
| Security             | 8%       | 4         | 4        |
| Maintainability      | 8%       | 4         | 4        |
| Developer Experience | 10%      | 3         | 5        |
| Ecosystem            | 12%      | 5         | 4        |
| Community Maturity   | 12%      | 5         | 4        |
| Licensing            | 8%       | 3         | 5        |
| Cloud Compatibility  | 10%      | 5         | 5        |
| Vendor Lock-in Risk  | 6%       | 4         | 4        |
| Estimated Cost       | 5%       | 4         | 3        |
| **Weighted Total**   | **100%** | **4.31**  | **4.13** |

## Weight Justification

- **Ecosystem (12%) and Community Maturity (12%)** are the two highest-weighted dimensions — directly serving Architecture §32's DR requirement that infrastructure be deterministically rebuildable "by any qualified engineer, not just the original author," which depends on a deep provider/module ecosystem and a wide hiring pool more than on any other single factor.
- **Developer Experience (10%) and Cloud Compatibility (10%)** are weighted above average but below the ecosystem dimensions — DX matters (Pulumi's clear win) but is secondary to the DR/rebuild requirement for infrastructure tooling specifically, unlike for a developer-facing product where DX might be weighted highest.
- **Scalability, Reliability, Security, Maintainability, Licensing (8% each)** are solid mid-tier weights — all real considerations, none individually decisive.
- **Performance, Vendor Lock-in Risk, Estimated Cost (5–6% each)** are lowest-weighted — both tools' raw plan/apply performance is dominated by cloud-provider API latency, not the tool itself; lock-in risk is low and comparable for both (open ecosystem, portable state model in principle); and IaC tooling cost is negligible relative to every infrastructure line it provisions.

## Result

Terraform wins the weighted total (4.31 vs. 4.13) primarily on the strength of its Ecosystem and Community Maturity weighting, consistent with the master TSR's Final Recommendation. Pulumi's Developer Experience and Licensing wins are real and are the explicitly named reasons it remains a "revisit if Terraform friction becomes a measured problem" alternative rather than a rejected option.
