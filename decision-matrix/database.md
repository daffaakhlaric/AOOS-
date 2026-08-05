# Decision Matrix — Database

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.4
Full rationale: [`tech-stack/database.md`](../tech-stack/database.md)

**How to read this matrix:** each dimension is scored 1–5, higher is better except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better. MySQL scores 2 (not 1) on Licensing due to Oracle's dual-licensing/commercial-edition complexity; CockroachDB and YugabyteDB also score 2 due to their BSL-derived licensing on advanced/enterprise features.

| Dimension            | Weight | PostgreSQL | MySQL    | CockroachDB | YugabyteDB |
| -------------------- | ------ | ---------- | -------- | ----------- | ---------- |
| Performance          | 8%     | 4          | 4        | 3           | 3          |
| Scalability          | 10%    | 3          | 3        | 5           | 5          |
| Reliability          | 15%    | 5          | 5        | 4           | 4          |
| Security             | 15%    | 5          | 3        | 5           | 5          |
| Maintainability      | 10%    | 5          | 5        | 3           | 2          |
| Developer Experience | 8%     | 5          | 4        | 4           | 3          |
| Ecosystem            | 10%    | 5          | 5        | 3           | 2          |
| Community Maturity   | 8%     | 5          | 5        | 3           | 2          |
| Licensing            | 4%     | 1          | 2        | 2           | 2          |
| Cloud Compatibility  | 5%     | 5          | 5        | 4           | 3          |
| Vendor Lock-in Risk  | 4%     | 1          | 1        | 2           | 2          |
| Estimated Cost       | 3%     | 2          | 2        | 4           | 4          |
| **Weighted Total***  | 100%   | **4.44**   | **4.03** | **3.53**    | **3.13**   |

\*Weighted total inverts Licensing/Vendor-Lock-in/Estimated-Cost (6 − score) before weighting so every dimension contributes positively to a higher-is-better total.

**Weighting rationale:** Reliability and Security are weighted highest (15% each) — for the platform's primary OLTP store holding tenant, lead, and conversation data, correctness of Tenant Isolation (DDD §25, Constitution RULE-016) and production durability outweigh developer convenience or raw throughput. This is a deliberate, explicit deviation from the more DX/Ecosystem-weighted profile used in §3.1–§3.3: a database is a durability-and-correctness-critical dependency in a way a language or frontend framework is not. Scalability, Maintainability, and Ecosystem follow at 8–10%, reflecting the real operational weight of running this technology for years across thousands of tenants. Licensing, Vendor Lock-in, and Cost are weighted lowest (3–4% each) individually, but collectively still penalize CockroachDB/YugabyteDB meaningfully given their BSL-derived terms.

PostgreSQL's highest weighted total, driven heavily by Reliability, Security, Maintainability, and Ecosystem, confirms its role as the default tier; MySQL's respectable total does not overturn PostgreSQL's win because MySQL's Security score (3, reflecting its application-layer-only RLS) is a hard disqualifier against DDD §25's storage-layer-enforcement requirement, not merely a lower preference — a case where the weighted total and the categorical requirement point the same direction.
