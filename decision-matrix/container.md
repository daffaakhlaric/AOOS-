# Decision Matrix — Container

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.19, §2 (Evaluation Methodology)
Full detail: [`tech-stack/container.md`](../tech-stack/container.md)

## How to read this matrix

Each dimension is scored **1 (worst) – 5 (best)**, except the two rows marked **(low = better)**, scored **1 (best/lowest) – 5 (worst/highest)**. The **Weighted Total** row inverts the low-is-better rows (`6 − raw score`) before weighting.

| Dimension                                             | Weight | Docker   | Podman   |
| ----------------------------------------------------- | ------ | -------- | -------- |
| Performance                                           | 6%     | 4        | 4        |
| Scalability                                           | 6%     | 4        | 4        |
| Reliability                                           | 8%     | 4        | 4        |
| Security                                              | 12%    | 3        | 5        |
| Maintainability                                       | 10%    | 4        | 3        |
| Developer Experience                                  | 12%    | 5        | 3        |
| Ecosystem                                             | 18%    | 5        | 3        |
| Community Maturity                                    | 10%    | 5        | 3        |
| Licensing                                             | 5%     | 4        | 5        |
| Cloud Compatibility                                   | 5%     | 5        | 4        |
| Vendor Lock-in Risk (low=better)                      | 4%     | 2        | 1        |
| Estimated Cost at AOS Scale (low=better)              | 4%     | 2        | 2        |
| **Weighted Total** (0–5 scale, cost/lock-in inverted) | 100%   | **4.28** | **3.44** |

## Weight justification

- **Ecosystem (18%)** weighted highest of any dimension in this table — this is the master TSR's explicitly stated deciding factor ("every other decision... assumes Docker-format images"), since Kubernetes, ArgoCD, and GitHub Actions tooling compatibility compounds across the entire platform, not just this one category.
- **Developer Experience (12%) and Security (12%)** weighted next highest and are the direct axis of tension in this decision: Docker wins DX/familiarity, Podman wins default security posture — both real, both weighted meaningfully, with the matrix showing Ecosystem tips the balance.
- **Maintainability (10%) and Community Maturity (10%)** weighted moderately-high — day-to-day operability and project-longevity risk both matter for a tool every engineer touches constantly.
- **Reliability (8%)** and **Performance/Scalability (6% each)** weighted lower — genuinely near-equivalent between the two candidates for AOS's purposes (§6–§8 of the full record explain why the production-runtime layer, not the build tool, governs these).
- **Licensing, Cloud Compatibility, Vendor Lock-in, Estimated Cost (4–5% each)** weighted lowest — both candidates are low-friction, low-cost, OCI-portable choices; the gap between them on these axes is real but small in absolute terms.

## Reading the result

The weighted total (4.28 vs. 3.44) is a clearer margin than the CI/CD or Observability comparisons, reflecting that this decision is dominated by one factor — ecosystem compatibility with every other already-made TSR decision — rather than a close multi-factor trade-off. Podman's Security advantage is real and not erased by the total; it is the specific reason it remains a named Future Consideration rather than being dismissed outright.
