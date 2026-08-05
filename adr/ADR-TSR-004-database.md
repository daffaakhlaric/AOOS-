# ADR-TSR-004 — Database

**Status:** Accepted

**Context:** The platform's primary OLTP data store must satisfy DDD §25 Tenant Isolation (native Row-Level Security as the storage-layer-enforced default, database-per-tenant as an escape hatch), support mature partitioning and strong HA/replication, be pgvector-compatible (§3.12 depends on the same instance by default), and draw from a large operational talent pool. Candidates evaluated: PostgreSQL, MySQL, CockroachDB, YugabyteDB — full evaluation in [`tech-stack/database.md`](../tech-stack/database.md) and [`decision-matrix/database.md`](../decision-matrix/database.md).

**Decision:** PostgreSQL (managed) is the default database for the shared RLS tier and schema-per-tenant tier. CockroachDB is the recommended Enterprise/Tier-1 escape hatch for tenants requiring automatic multi-region strong consistency or horizontal write-scaling beyond a single Postgres primary's comfortable capacity.

**Consequences:** The platform operates two database technologies rather than one, adding operational surface, but this is the direct, intentional realization of Architecture §12's stated database-per-tenant escape hatch, not incidental sprawl. PostgreSQL's native RLS and pgvector extension mean the default tier needs no additional database technology for Memory/Knowledge embeddings. CockroachDB's BSL-derived licensing on advanced/enterprise features must be explicitly tracked and budgeted for the Enterprise tenant subset, per the named migration trigger in `migration/migration-and-upgrade-strategy.md` §2.

**Alternatives Considered:**

- **MySQL** — rejected: RLS is application-layer only, violating DDD §25's storage-layer-enforcement principle, and it lacks pgvector, which would force a second database for Memory/Knowledge that PostgreSQL avoids by itself.
- **YugabyteDB as the Enterprise escape hatch instead of CockroachDB** — rejected for now: CockroachDB has more mature managed-service availability and a broader operational track record at the time of this writing; YugabyteDB remains a credible alternative flagged for re-evaluation at the Year 2 roadmap checkpoint.
- **CockroachDB or YugabyteDB as the platform-wide default** — rejected: consensus overhead and higher operational/licensing cost are unjustified for the majority of tenants whose per-tenant transaction volume does not require distributed-SQL's horizontal-write-scaling trade-off; reserved for the Enterprise tier that actually needs it.
