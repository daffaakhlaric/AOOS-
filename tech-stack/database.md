# Tech Stack Record — Database

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.4
Decision Matrix: [`decision-matrix/database.md`](../decision-matrix/database.md)
ADR: [`adr/ADR-TSR-004-database.md`](../adr/ADR-TSR-004-database.md)

---

## Objective

Choose the primary OLTP data store satisfying DDD §25 Tenant Isolation (Row-Level Security default, database-per-tenant escape hatch) and Architecture §12's stated escape-hatch pattern for demanding tenants.

## Requirements

- Native Row-Level Security enforced at the storage layer, not application code (DDD §25).
- Mature partitioning support for multi-tenant data growth.
- Strong HA/replication for production reliability.
- pgvector compatibility, since Vector Database (§3.12) defaults to the same instance as the primary OLTP store.
- Large operational talent pool, given the platform's projected multi-year operational lifespan.

## Candidate Technologies

- **PostgreSQL**
- **MySQL**
- **CockroachDB**
- **YugabyteDB**

## Evaluation Matrix

Scoring: 1–5, higher is better for all dimensions except **Estimated Cost** and **Vendor Lock-in Risk**, where lower is better.

| Dimension                        | PostgreSQL | MySQL | CockroachDB | YugabyteDB |
| -------------------------------- | ---------- | ----- | ----------- | ---------- |
| Performance                      | 4          | 4     | 3           | 3          |
| Scalability                      | 3          | 3     | 5           | 5          |
| Reliability                      | 5          | 5     | 4           | 4          |
| Security                         | 5          | 3     | 5           | 5          |
| Maintainability                  | 5          | 5     | 3           | 2          |
| Developer Experience             | 5          | 4     | 4           | 3          |
| Ecosystem                        | 5          | 5     | 3           | 2          |
| Community Maturity               | 5          | 5     | 3           | 2          |
| Licensing (1 = most permissive)  | 1          | 2     | 2           | 2          |
| Cloud Compatibility              | 5          | 5     | 4           | 3          |
| Vendor Lock-in Risk (1 = lowest) | 1          | 1     | 2           | 2          |
| Estimated Cost (1 = lowest)      | 2          | 2     | 4           | 4          |

MySQL scores 2 (not 1) on Licensing because while MySQL Community Edition is GPLv2, Oracle's dual-licensing/commercial-edition model around it introduces more commercial-licensing complexity than PostgreSQL's straightforward permissive license. CockroachDB and YugabyteDB score 2 on Licensing because both ship under Business Source License (BSL)-derived terms for portions of their advanced/enterprise feature set (converting to Apache 2.0 after a time-delay window), a materially more complex licensing posture than pure PostgreSQL.

## Benchmark

See [`benchmarks/database-benchmarks.md`](../benchmarks/database-benchmarks.md) §1 (Relational/OLTP) — directional figures from vendor documentation and commonly cited industry benchmarks, not AOS-measured. Key takeaway: PostgreSQL and MySQL both offer high single-node write throughput with no consensus overhead; CockroachDB and YugabyteDB trade some single-node throughput for automatic multi-region consensus-based replication and horizontal write-scaling — a deliberate trade AOS accepts only for the Enterprise/Tier-1 escape-hatch tenant subset, not the default tier.

## Performance

PostgreSQL and MySQL both deliver high single-node OLTP throughput with no distributed-consensus tax, which is why they remain the default-tier choice for the vast majority of tenants whose per-tenant transaction volume does not require distributed-SQL's horizontal-write-scaling trade-off. CockroachDB and YugabyteDB accept a real per-write consensus-latency cost in exchange for automatic multi-region strong consistency and horizontal write scaling — a cost worth paying only for the specific Enterprise tenants who need what that consensus buys them.

## Scalability

CockroachDB and YugabyteDB both scale horizontally by design (automatic range/hash or tablet sharding), giving them the highest ceiling of the four candidates for a single logical database. PostgreSQL and MySQL scale primarily via read replicas and, for very large tenants, manual sharding/partitioning — sufficient for AOS's default RLS-shared and schema-per-tenant tiers (DDD §25), where the unit of scale is "per tenant," not "one enormous single database."

## Reliability

PostgreSQL and MySQL both have decades of production hardening, mature streaming/logical replication, and well-understood failure modes — the deepest reliability track record of the four. CockroachDB and YugabyteDB are reliable by design (built-in consensus-based fault tolerance survives node loss without manual failover) but have a shorter absolute production track record across the industry than Postgres/MySQL, a real, acknowledged trade reflected in RISK-006 of the risk register (smaller CockroachDB/YugabyteDB operational talent pool risking slower incident response).

## Security

PostgreSQL, CockroachDB, and YugabyteDB all support native Row-Level Security enforced at the storage layer — directly satisfying DDD §25's storage-layer-enforcement principle. MySQL's RLS story is application-layer only, a direct disqualifier against the platform's Tenant Isolation requirement, not merely a lesser preference. CockroachDB/YugabyteDB inherit Postgres-compatible RLS semantics, closing the gap with plain PostgreSQL on this dimension specifically.

## Maintainability

PostgreSQL and MySQL both benefit from the largest available body of institutional knowledge, tooling, and third-party operational support (managed-service providers, monitoring integrations, migration tooling) of any relational database, making long-term maintainability the strongest of the four. CockroachDB and YugabyteDB, while operationally simpler in some respects (self-healing, no manual failover), require a smaller, more specialized operational skill set that is harder to hire and retain at scale — captured in RISK-006.

## Developer Experience

PostgreSQL offers the richest DX of the four for a TypeScript/Drizzle-based stack (§3.5) — mature tooling, extension ecosystem (including pgvector, §3.12), and the deepest available documentation/community-answer base. CockroachDB and YugabyteDB both aim for wire-compatibility with PostgreSQL specifically to minimize this DX gap, which is why they remain credible escape-hatch options rather than requiring a different data-access paradigm.

## Ecosystem

PostgreSQL's extension ecosystem (pgvector, PostGIS, and a wide range of others) and its position as the most widely adopted "serious" open-source RDBMS give it the deepest ecosystem of the four. MySQL's ecosystem is nearly as large but lacks pgvector, which — combined with its RLS limitation — is the direct reason it is not recommended. CockroachDB and YugabyteDB have smaller, though growing, ecosystems specific to distributed SQL.

## Community Maturity

PostgreSQL and MySQL both have very large, long-established communities. CockroachDB and YugabyteDB have smaller, though credible and growing, communities reflecting their more specialized distributed-SQL niche and shorter time in market.

## Licensing

PostgreSQL: PostgreSQL License (a permissive, MIT/BSD-style license) — the cleanest licensing posture of the four. MySQL: GPLv2 (Community Edition), with Oracle offering commercial dual-licensing for the enterprise edition — more licensing complexity for a commercial SaaS than plain PostgreSQL. CockroachDB: Business Source License (BSL) 1.1 for the core, converting to Apache 2.0 after a multi-year delay per version, with a separate Enterprise license for advanced features (including some multi-region capabilities AOS's escape-hatch use case may depend on) — this must be explicitly budgeted and tracked, not assumed free. YugabyteDB: similarly BSL-derived for portions of its feature set, with an Apache 2.0 core.

## Cloud Compatibility

PostgreSQL and MySQL are both available as fully managed services on every major cloud provider (RDS, Cloud SQL, Azure Database, plus Postgres-specialist providers like Neon), the deepest managed-service availability of the four. CockroachDB and YugabyteDB both offer their own managed cloud services (CockroachDB Cloud, YugabyteDB Managed) plus self-hosted Kubernetes operators, but with fewer third-party managed-service alternatives than Postgres/MySQL enjoy.

## Vendor Lock-in

PostgreSQL carries the lowest vendor lock-in of the four — it is available from a very large number of independent managed-service providers plus trivial self-hosting, meaning no single vendor controls its roadmap or pricing. MySQL is similarly low-lock-in despite Oracle's stewardship, given the breadth of alternative providers (including community forks like MariaDB). CockroachDB and YugabyteDB carry moderately higher lock-in risk: fewer independent managed-service alternatives exist, and their BSL licensing terms mean some advanced features are tied to the vendor's own commercial terms rather than a fully open ecosystem — this is explicitly why they are scoped to the Enterprise escape-hatch tier only, not the default tier for all tenants.

## Estimated Cost

PostgreSQL and MySQL managed-service pricing is well-understood and competitive, benefiting from the deepest managed-provider market of the four. CockroachDB/YugabyteDB carry a real cost premium (both infrastructure — consensus overhead requires more nodes for equivalent throughput — and licensing, if Enterprise-tier features are needed) reflected in the cost model: see [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §4 (Database), which explicitly assumes the CockroachDB slice applies only to a small fraction (~2%) of the Enterprise tenant base at 1,000+ dealer scale, not the default tier — this is the direct cost justification for keeping CockroachDB an escape hatch rather than the platform default.

## Pros

- PostgreSQL's native RLS directly satisfies DDD §25's storage-layer-enforcement Tenant Isolation requirement.
- pgvector compatibility means the default tier needs one fewer database technology for Memory/Knowledge embeddings (§3.12).
- Deepest managed-service market and operational talent pool of the four candidates, lowering both cost and hiring risk.
- CockroachDB provides a genuine, architecturally-intentional escape hatch for the specific tenant subset that needs automatic multi-region strong consistency.

## Cons

- Running two database technologies (Postgres default + CockroachDB for Enterprise tier) is more operational surface than a single-database strategy.
- CockroachDB's BSL-derived licensing for advanced/enterprise features requires explicit cost/licensing tracking, not assumed-free open source.
- PostgreSQL alone does not natively scale writes horizontally the way CockroachDB/YugabyteDB do, requiring the escape hatch to exist at all for the tenants who need it.

## Trade-offs

Running two database technologies (Postgres default + CockroachDB for Enterprise tier) is more operational surface than one, but is the direct, intentional realization of Architecture §12's stated database-per-tenant escape hatch for demanding tenants — the alternative (forcing every tenant onto Postgres regardless of region/scale needs, or forcing every tenant onto CockroachDB's higher-cost, higher-ops-complexity model by default) would violate that already-established architecture or waste cost/complexity on tenants who do not need it.

## Final Recommendation

**PostgreSQL** (managed — RDS/Cloud SQL/Neon-class provider) as the default for the shared RLS tier and schema-per-tenant tier (DDD §25). **CockroachDB** recommended as the **Enterprise/Tier-1 escape hatch** for tenants requiring automatic multi-region strong consistency and horizontal write-scaling beyond what a single Postgres primary comfortably handles — chosen over YugabyteDB primarily for its more mature managed-service availability and broader operational track record at the time of this writing. **MySQL is not recommended** — its RLS story is application-layer only and it lacks pgvector, forcing a second database for Memory/Knowledge that Postgres avoids by itself. This matches the master TSR §3.4 Final Recommendation exactly.

## ADR Reference

[`adr/ADR-TSR-004-database.md`](../adr/ADR-TSR-004-database.md)

## Migration Strategy

Named migration path in [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) §2: PostgreSQL (shared RLS / schema-per-tenant) → CockroachDB (Enterprise multi-region tier), triggered when a specific tenant contractually requires multi-region strong consistency/data residency spanning regions, or single-Postgres-primary write throughput sustained above roughly 70% capacity for that tenant's workload. Migration is per-tenant, not platform-wide: a dedicated CockroachDB cluster is provisioned for the qualifying tenant, migrated via logical replication / dual-write cutover, and validated against the tenant's isolation test suite (DDD §25) before final cutover — never a platform-wide big-bang migration.

## Future Consideration

YugabyteDB remains a credible alternative to CockroachDB for the Enterprise escape hatch and should be re-evaluated at the Year 2 Technology Roadmap checkpoint (`roadmap/technology-roadmap.md`) once both products' managed-service maturity and licensing terms are compared against two years of real usage data rather than launch-time estimates. A DR/multi-region-capable, fully Apache-2.0-licensed distributed-SQL option (should one mature further) would also be worth re-evaluating against CockroachDB's current BSL-derived licensing terms.
