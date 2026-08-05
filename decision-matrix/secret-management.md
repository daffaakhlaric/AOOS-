# Decision Matrix — Secret Management

**Category:** §3.22 of [`../docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**Full record:** [`../tech-stack/secret-management.md`](../tech-stack/secret-management.md)
**ADR:** [`../adr/ADR-TSR-022-secret-management.md`](../adr/ADR-TSR-022-secret-management.md)

## How to read this matrix

Every dimension is scored **1 (worst) – 5 (best)**, except two dimensions inverted so "5" always means "best for AOS":

- **Vendor Lock-in Risk** — **5 = lowest lock-in risk**, 1 = highest.
- **Estimated Cost** — **5 = cheapest at 10,000-dealer scale**, 1 = most expensive.

Scores reflect qualitative, documentation-stage judgment (no AOS-specific benchmark has been run), weighted toward this category's decisive requirement: correctly, securely resolving the Tool Contract's `authentication.secret_ref` field per-invocation, per-tenant, with audit logging (Constitution RULE-060). The **Weighted Total** row weights each dimension by its importance to that requirement, not a flat average — Security carries the largest single weight in this matrix of any category in the TSR, reflecting that this category exists specifically to satisfy a named security-critical Constitution rule.

## Scoring Matrix

| Dimension            | Weight   | Vault    | AWS Secrets Manager | Doppler  |
| -------------------- | -------- | -------- | ------------------- | -------- |
| Performance          | 4%       | 4        | 5                   | 4        |
| Scalability          | 8%       | 5        | 4                   | 3        |
| Reliability          | 8%       | 4        | 5                   | 4        |
| Security             | 22%      | 5        | 3                   | 3        |
| Maintainability      | 6%       | 3        | 5                   | 4        |
| Developer Experience | 5%       | 3        | 3                   | 5        |
| Ecosystem            | 8%       | 5        | 4                   | 3        |
| Community Maturity   | 5%       | 5        | 5                   | 3        |
| Licensing            | 5%       | 3        | 5                   | 3        |
| Cloud Compatibility  | 12%      | 5        | 1                   | 5        |
| Vendor Lock-in Risk  | 10%      | 4        | 1                   | 2        |
| Estimated Cost       | 7%       | 4        | 2                   | 2        |
| **Weighted Total**   | **100%** | **4.31** | **3.24**            | **3.29** |

## Weight Justification

- **Security (22%)** dominates this matrix by design — this category exists to satisfy Constitution RULE-060 and the Tool Contract's `authentication` field resolution model; a secrets manager that scores well everywhere else but poorly on dynamic-secret support and fine-grained per-tenant policy would still be the wrong choice for AOS.
- **Cloud Compatibility (12%)** is weighted highly because AWS Secrets Manager's single-cloud scope is a structural disqualifier against this TSR's multi-cloud posture (R2 default + S3 fallback + MinIO self-hosted, §3.13), not a minor deduction — this weight is what makes that disqualification show up decisively in the total.
- **Vendor Lock-in Risk (10%)** is weighted above average for the same reason — a secrets manager sitting in every Tool call's credential-resolution path is an unusually high-leverage point for lock-in risk to matter.
- **Scalability, Ecosystem (8% each)** reflect Vault's genuine architectural fit for AOS's per-tenant/per-Tool secret-sprawl pattern and its IaC/Kubernetes/database-engine integration depth.
- **Estimated Cost (7%)** is weighted moderately — real at scale (per-secret/per-API-call pricing compounding across thousands of tenants) but smaller in absolute dollar terms than categories like Monitoring or AI Inference.
- **Reliability, Maintainability (6–8%)** intentionally keep AWS Secrets Manager's "fully managed, no HA burden" advantage visible in the total without letting it outweigh the Security/Cloud-Compatibility structural requirements.
- **Performance, Developer Experience, Community Maturity, Licensing (4–5% each)** are the lowest-weighted — real differentiators (Doppler's DX in particular) but secondary to whether the tool can actually satisfy the Tool Contract's security model at multi-cloud, multi-tenant scale.

## Result

Vault wins the weighted total (4.31) decisively, driven by its Security score under the heaviest weight in the matrix plus a clean Cloud Compatibility score neither competitor matches. AWS Secrets Manager and Doppler score closely to each other (3.24 vs. 3.29) — both are legitimate for their explicitly scoped, narrower roles (AWS Secrets Manager as a simpler single-cloud-committed default; Doppler for development-environment distribution only), never as the primary production secrets custody choice.
