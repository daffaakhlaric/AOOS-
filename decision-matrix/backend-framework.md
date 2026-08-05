# Decision Matrix — Backend Framework

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.2
Full rationale: [`tech-stack/backend-framework.md`](../tech-stack/backend-framework.md)

**How to read this matrix:** each dimension is scored 1–5, higher is better except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better. FastAPI and Go Fiber are included for completeness (they are named candidates in the master doc) but are scoped only to the Python/Go services already carved out in §3.1 — they are not competing with NestJS/Fastify/Express for the primary TypeScript backend decision.

| Dimension            | Weight | NestJS   | Fastify  | Express  | FastAPI  | Go Fiber |
| -------------------- | ------ | -------- | -------- | -------- | -------- | -------- |
| Performance          | 10%    | 3        | 5        | 3        | 4        | 5        |
| Scalability          | 8%     | 4        | 5        | 3        | 4        | 5        |
| Reliability          | 10%    | 4        | 4        | 4        | 4        | 4        |
| Security             | 10%    | 4        | 4        | 3        | 4        | 4        |
| Maintainability      | 15%    | 5        | 3        | 2        | 4        | 3        |
| Developer Experience | 12%    | 4        | 4        | 3        | 5        | 4        |
| Ecosystem            | 12%    | 5        | 4        | 5        | 4        | 3        |
| Community Maturity   | 8%     | 5        | 4        | 5        | 4        | 3        |
| Licensing            | 3%     | 1        | 1        | 1        | 1        | 1        |
| Cloud Compatibility  | 5%     | 5        | 5        | 5        | 5        | 5        |
| Vendor Lock-in Risk  | 3%     | 1        | 1        | 1        | 1        | 1        |
| Estimated Cost       | 4%     | 2        | 2        | 2        | 2        | 2        |
| **Weighted Total***  | 100%   | **4.15** | **3.83** | **3.44** | **3.99** | **3.71** |

\*Weighted total inverts Licensing/Vendor-Lock-in/Estimated-Cost (6 − score) before weighting so every dimension contributes positively to a higher-is-better total.

**Weighting rationale:** Maintainability is weighted highest (15%) because AOS's Hexagonal/Plugin-First architecture (Constitution §3.11, §3.1) makes framework structure a multi-year maintainability decision, not a one-time convenience. Developer Experience and Ecosystem follow (12% each) given the Contract-First codegen requirement (doc 003.5 §1.4) that OpenAPI generation quality directly serves. Performance, Reliability, and Security are weighted at 10% each — real, but secondary to structural fit since raw throughput differences are largely absorbed by horizontal scaling (§3.20). Licensing and Vendor-Lock-in are weighted lowest (3% each) since none of the five candidates differentiates on those axes.

NestJS's highest weighted total (driven by Maintainability and Ecosystem) confirms the master doc's recommendation; FastAPI's high score reflects its strength within its own already-scoped Python domain, not a challenge to NestJS's primary-backend role.
