# Decision Matrix — Orchestration

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.20, §2 (Evaluation Methodology)
Full detail: [`tech-stack/orchestration.md`](../tech-stack/orchestration.md)

## How to read this matrix

Each dimension is scored **1 (worst) – 5 (best)**, except the two rows marked **(low = better)**, scored **1 (best/lowest) – 5 (worst/highest)**. The **Weighted Total** row inverts the low-is-better rows (`6 − raw score`) before weighting.

| Dimension                                             | Weight | Kubernetes (managed) | Nomad    | Docker Swarm |
| ----------------------------------------------------- | ------ | -------------------- | -------- | ------------ |
| Performance                                           | 6%     | 4                    | 4        | 3            |
| Scalability                                           | 15%    | 5                    | 4        | 2            |
| Reliability                                           | 10%    | 5                    | 4        | 3            |
| Security                                              | 8%     | 4                    | 4        | 3            |
| Maintainability                                       | 8%     | 3                    | 4        | 4            |
| Developer Experience                                  | 6%     | 3                    | 4        | 4            |
| Ecosystem                                             | 18%    | 5                    | 2        | 2            |
| Community Maturity                                    | 8%     | 5                    | 3        | 2            |
| Licensing                                             | 6%     | 5                    | 3        | 5            |
| Cloud Compatibility                                   | 5%     | 5                    | 4        | 3            |
| Vendor Lock-in Risk (low=better)                      | 5%     | 2                    | 2        | 2            |
| Estimated Cost at AOS Scale (low=better)              | 5%     | 3                    | 2        | 2            |
| **Weighted Total** (0–5 scale, cost/lock-in inverted) | 100%   | **4.32**             | **3.34** | **2.87**     |

## Weight justification

- **Ecosystem (18%)** weighted highest — the master TSR's explicit deciding factor: the operator/tooling landscape for AOS's own named stateful dependencies (Temporal, NATS JetStream, Postgres/CockroachDB) plus ArgoCD/Kong integration compounds across nearly every other TSR decision, making this the single highest-leverage axis.
- **Scalability (15%)** weighted second-highest because Architecture §31's autoscaling requirement at thousands-of-dealer scale is a named, hard requirement, not an aspiration, and is the specific axis where Docker Swarm is disqualified outright.
- **Reliability (10%)** weighted above average given the platform's live, autonomous, customer-facing nature (Architecture §11) makes orchestration-layer self-healing directly relevant to uptime.
- **Community Maturity (8%), Security (8%), Maintainability (8%)** weighted moderately — real, ongoing operational considerations, with Maintainability specifically capturing Kubernetes's honestly-acknowledged complexity cost.
- **Licensing (6%)** weighted above the smallest tier specifically to register Nomad's BSL 1.1 relicensing as a real, non-trivial factor, not a footnote — distinct from a simple feature comparison.
- **Performance (6%), Developer Experience (6%), Cloud Compatibility (5%), Vendor Lock-in (5%), Estimated Cost (5%)** weighted lowest — all real, but not the differentiating axis for this specific decision per §6–§11 and §16–§17 of the full record.

## Reading the result

The weighted total (4.32 vs. 3.34 vs. 2.87) shows a clear, wide margin, consistent with the master TSR's confident, unhedged Final Recommendation for this category (unlike the closer CI/CD and Observability comparisons). Kubernetes wins decisively on Ecosystem and Scalability — the two highest-weighted dimensions — while Maintainability and Developer Experience, where Nomad and Swarm both score higher, are deliberately weighted lower because Kubernetes's operational complexity is mitigated by the managed-service choice (EKS/GKE-class) and by ArgoCD/Terraform owning most manifest authoring on the platform team's behalf.
