# Decision Matrix — CI/CD

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.18, §2 (Evaluation Methodology)
Full detail: [`tech-stack/cicd.md`](../tech-stack/cicd.md)

## How to read this matrix

Each dimension is scored **1 (worst) – 5 (best)**, except the two rows marked **(low = better)**, scored **1 (best/lowest) – 5 (worst/highest)**. "GitHub Actions + ArgoCD" (the adopted two-tool pairing) is compared against "GitLab CI (combined)" as a single-tool alternative capable of both CI and GitOps CD via its own agent. The **Weighted Total** row inverts the low-is-better rows (`6 − raw score`) before weighting.

| Dimension                                             | Weight | GitHub Actions + ArgoCD | GitLab CI (combined) |
| ----------------------------------------------------- | ------ | ----------------------- | -------------------- |
| Performance                                           | 8%     | 4                       | 4                    |
| Scalability                                           | 8%     | 4                       | 4                    |
| Reliability                                           | 10%    | 4                       | 4                    |
| Security                                              | 15%    | 4                       | 4                    |
| Maintainability                                       | 10%    | 3                       | 4                    |
| Developer Experience                                  | 10%    | 4                       | 4                    |
| Ecosystem                                             | 12%    | 5                       | 4                    |
| Community Maturity                                    | 7%     | 5                       | 4                    |
| Licensing                                             | 5%     | 3                       | 3                    |
| Cloud Compatibility                                   | 5%     | 5                       | 4                    |
| Vendor Lock-in Risk (low=better)                      | 5%     | 3                       | 3                    |
| Estimated Cost at AOS Scale (low=better)              | 5%     | 2                       | 2                    |
| **Weighted Total** (0–5 scale, cost/lock-in inverted) | 100%   | **4.09**                | **3.92**             |

## Weight justification

- **Security (15%)** weighted highest — GitOps' removal of standing production cluster credentials from the CI pipeline (ArgoCD pulls, rather than CI pushing, with cluster credentials) is a direct, material implementation of RULE-062's least-privilege principle applied to the deployment pipeline itself, the single strongest differentiator in this category.
- **Ecosystem (12%)** weighted high because GitHub Actions' marketplace breadth and ArgoCD's native Kubernetes/Kong/Temporal/Terraform ecosystem alignment (all already-selected TSR technologies) compound across the rest of the stack.
- **Reliability (10%), Maintainability (10%), Developer Experience (10%)** weighted at a solid baseline — real considerations for day-to-day engineering velocity, but not the deciding axis per the master TSR's stated rationale.
- **Community Maturity (7%), Scalability (8%), Performance (8%)** moderate — both candidates are mature, well-adopted tools; this is not strongly differentiating.
- **Licensing (5%), Cloud Compatibility (5%), Vendor Lock-in (5%), Estimated Cost (5%)** weighted lowest — both candidates carry broadly comparable proprietary-hosted-CI-plus-open-CD cost/lock-in shape; the difference between them on these axes is marginal relative to the Security/Ecosystem gap.

## Reading the result

The weighted total (4.09 vs. 3.92) is a close margin, reflecting that GitLab CI (combined) is a genuinely credible alternative — the master TSR names it explicitly as the direct substitute if GitHub is not the source-control host. The GitHub Actions + ArgoCD pairing wins primarily on Security (the GitOps pull model) and Ecosystem (native alignment with Kubernetes/Kong/Temporal/Terraform), not because GitLab CI is a weak tool.
