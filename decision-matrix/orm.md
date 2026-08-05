# Decision Matrix — ORM

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.5
Full rationale: [`tech-stack/orm.md`](../tech-stack/orm.md)

**How to read this matrix:** each dimension is scored 1–5, higher is better except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better. Prisma scores 2 (not 1) on Vendor Lock-in Risk because its query-engine binary and optional Accelerate/Data Proxy product introduce a degree of Prisma-specific infrastructure dependency that Drizzle and TypeORM, both thin query-builder libraries, do not carry.

| Dimension            | Weight | Prisma   | Drizzle  | TypeORM  |
| -------------------- | ------ | -------- | -------- | -------- |
| Performance          | 10%    | 3        | 5        | 3        |
| Scalability          | 8%     | 3        | 5        | 3        |
| Reliability          | 10%    | 4        | 4        | 3        |
| Security             | 20%    | 3        | 5        | 3        |
| Maintainability      | 12%    | 4        | 4        | 3        |
| Developer Experience | 12%    | 5        | 4        | 3        |
| Ecosystem            | 8%     | 5        | 3        | 4        |
| Community Maturity   | 6%     | 5        | 3        | 4        |
| Licensing            | 3%     | 1        | 1        | 1        |
| Cloud Compatibility  | 5%     | 5        | 5        | 5        |
| Vendor Lock-in Risk  | 3%     | 2        | 1        | 1        |
| Estimated Cost       | 3%     | 2        | 2        | 2        |
| **Weighted Total***  | 100%   | **3.94** | **4.36** | **3.51** |

\*Weighted total inverts Licensing/Vendor-Lock-in/Estimated-Cost (6 − score) before weighting so every dimension contributes positively to a higher-is-better total.

**Weighting rationale:** Security is weighted highest of any dimension in this matrix (20%) — deliberately higher than the equivalent dimension's weight in any other category in this TSR — because the ORM sits directly on the path of the platform's Row-Level Security tenant-isolation guarantee (Constitution RULE-016, DDD §25); a correctness failure here is a cross-tenant data leak, the single most severe class of failure a multi-tenant SaaS can have. Developer Experience and Maintainability follow at 12% each, reflecting real day-to-day engineering-velocity impact. Performance and Reliability sit at 10% each. Ecosystem and Community Maturity are weighted lower (6–8%) than in the Programming Language or Frontend matrices — deliberately, since an ORM's tooling gap is a recoverable inconvenience, not a structural risk, in a way that a language's or framework's ecosystem gap would not be.

Drizzle's highest weighted total, driven overwhelmingly by its Security score, confirms the master doc's recommendation even though Prisma out-scores it on Developer Experience, Ecosystem, and Community Maturity — an explicit, intentional instance of a security-critical dimension's weight overriding a convenience advantage.
