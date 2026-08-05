# Decision Matrix — API Gateway

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.15 · Full detail: [`tech-stack/api-gateway.md`](../tech-stack/api-gateway.md) · ADR: [`adr/ADR-TSR-015-api-gateway.md`](../adr/ADR-TSR-015-api-gateway.md)

## How to read this matrix

- Scale is **1 (worst) to 5 (best)**. **Vendor Lock-in Risk** and **Estimated Cost** are scored so that **5 = lowest risk / lowest cost**.
- Envoy is not a peer "API Gateway product" the way Kong and Traefik are — it is a proxy/data-plane technology most commonly operated underneath a service-mesh control plane (e.g., Istio). It is scored here on the same dimensions for completeness and transparency, but its Maintainability and Developer Experience scores specifically reflect its cost _as a standalone gateway_, not its cost within a full service-mesh deployment (a different, larger infrastructure commitment this category is not recommending).
- Kong and Traefik land close together on several dimensions because both are credible, production-proven API-gateway-shaped tools; the differentiator between them is enterprise-plugin-ecosystem depth (Kong) versus Kubernetes-native operational simplicity (Traefik), not a broad capability gap.

## Scoring Matrix

| Dimension                             | Weight   | Kong     | Traefik  | Envoy    |
| ------------------------------------- | -------- | -------- | -------- | -------- |
| Performance                           | 8%       | 4        | 4        | 5        |
| Scalability                           | 12%      | 4        | 4        | 5        |
| Reliability                           | 12%      | 4        | 4        | 5        |
| Security                              | 8%       | 4        | 4        | 3        |
| Maintainability                       | 8%       | 3        | 4        | 2        |
| Developer Experience                  | 8%       | 4        | 4        | 2        |
| Ecosystem                             | 8%       | 5        | 3        | 4        |
| Community Maturity                    | 6%       | 5        | 4        | 5        |
| Licensing                             | 8%       | 4        | 5        | 5        |
| Cloud Compatibility                   | 6%       | 5        | 5        | 5        |
| Vendor Lock-in Risk (5 = lowest risk) | 10%      | 4        | 4        | 5        |
| Estimated Cost (5 = lowest cost)      | 6%       | 3        | 4        | 4        |
| **Weighted Total**                    | **100%** | **4.06** | **4.06** | **4.22** |

**Weight justification:** Scalability and Reliability are weighted highest (12% each), the standard pattern across this TSR, because the API Gateway is a platform-critical, always-on ingress path where an outage or capacity failure is directly customer-visible. Vendor Lock-in Risk is weighted at 10% specifically because Kong's OSS/Enterprise tier split (§16 of `tech-stack/api-gateway.md`) is a named, tracked risk (`risk/risk-register.md` RISK-010) that a lower weight would understate. Ecosystem is weighted at 8% rather than higher, deliberately, because this category's decisive factor is plugin-ecosystem _fit_ to AOS's specific multi-tenant auth/rate-limiting requirements, not ecosystem size in the abstract — a nuance the weighted total alone does not fully capture.

**Reading the weighted total honestly:** Envoy's 4.22 is the highest of the three, and Kong and Traefik are numerically tied at 4.06 — a result that, read as a bare number, would not obviously favor Kong. The Final Recommendation does not rest on the weighted total: Envoy is excluded from consideration as a standalone Gateway choice on structural grounds (§20/§21 of `tech-stack/api-gateway.md` — it is architecturally a service-mesh data plane, not a complete gateway product, and adopting it as one would require building substantial policy-enforcement logic from lower-level primitives or adopting a full service mesh earlier than AOS's scale justifies). Between the tied Kong and Traefik, Kong is preferred on the qualitative, harder-to-score-numerically criterion of plugin-architecture alignment with AOS's own Plugin-First principle (Constitution §3.1) and its deeper enterprise multi-tenant auth/rate-limiting plugin catalog — Traefik remains explicitly recommended as the better fit for lower-stakes internal/dev-environment gateways specifically, so the near-tie is not discarded, it is resolved by scope rather than forced into a single winner-take-all outcome.
