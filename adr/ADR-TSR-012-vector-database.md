# ADR-TSR-012 — Vector Database: pgvector Default, Qdrant Enterprise/Scale Escape Hatch

**Status:** Accepted

**Context:** The Memory Contract's `SemanticMemory`/`VectorMemory` fields and the Knowledge Contract's `Embedding` field (doc 003.5 §8–9) require a tenant-partitioned similarity search store for Agent long-term semantic recall and Knowledge-grounded RAG retrieval (Architecture §20–21). PostgreSQL was already selected as the primary OLTP database (TSR §3.4, ADR-TSR-004) with native Row-Level Security as the default tenant-isolation mechanism (DDD §25). AOS's near-term tenant profile is thousands of tenants each with a moderate embedding volume (cost model assumption: ~500MB/dealer), not one tenant with a very large vector collection — a shape that favors operational simplicity over raw large-scale vector-query throughput for the default case, while still requiring a credible path for the minority of tenants/aggregate load that exceeds it.

**Decision:** **pgvector** (PostgreSQL extension) is the default vector store for the shared/default tenant tier, reusing the already-provisioned Postgres instance and its native RLS tenant isolation with no additional infrastructure. **Qdrant** is the designated Enterprise/scale escape hatch, activated per the trigger condition in `migration/migration-and-upgrade-strategy.md` (aggregate embedding volume or RAG query p95 latency crossing a measured threshold), chosen over Weaviate and Milvus for its single-binary operational simplicity, strong tenant-payload filtering performance, and unambiguous Apache-2.0 licensing.

**Consequences:**

- Zero incremental infrastructure or vector-specific tenant-isolation model to build/verify at the default tier — pgvector rows are governed by the same RLS session-variable scoping as every other tenant-scoped table.
- A single-node Postgres write/index-maintenance ceiling applies to the default tier's vector workload until the Qdrant escape hatch activates for a given tenant or in aggregate.
- Two vector-store technologies exist in production once the escape hatch is active, requiring the dual-write/shadow-read migration discipline documented in `migration/migration-and-upgrade-strategy.md` rather than an ad hoc cutover.
- Qdrant's own tenant-isolation model (payload filtering by `tenant_id`) is a second isolation mechanism to test and audit, distinct from RLS, scoped only to tenants/load that have migrated.
- Milvus's larger vector-scale ceiling is deliberately not adopted even as the escape hatch, trading away theoretical maximum scale for materially lower operational complexity appropriate to AOS's actual near-term tenant profile.

**Alternatives Considered:**

- **Qdrant as the default tier** (rejected: would introduce a second database technology and a second tenant-isolation model for every tenant from day one, including the majority whose embedding volume never approaches the threshold that would justify it — contradicts TSR §1 point 1, cost efficiency over unneeded peak capability).
- **Weaviate as the escape hatch** (rejected: technically comparable to Qdrant on most dimensions, but its schema/class model adds conceptual complexity and its licensing posture mixes an open core with separately gated enterprise features — Qdrant's simpler, unambiguously Apache-2.0-licensed model is preferred on the same licensing-clarity reasoning applied to Cache, §3.6, and Search Engine, §3.14).
- **Milvus as the escape hatch** (rejected: purpose-built for billion-scale vector collections AOS does not anticipate needing; its distributed dependency chain — etcd, MinIO/S3-compatible storage, Pulsar/Kafka — is materially more operational surface than the tenant/load profile that triggers the escape hatch actually requires).
- **A single vector-store technology for all tiers, with no escape hatch** (rejected: would force either premature infrastructure investment for the default case or an eventual hard scale ceiling for growing tenants — the same "default + named escape hatch" pattern already applied to Database, §3.4, Cache, §3.6, and Object Storage, §3.13, is preferred for consistency and because it has already proven itself elsewhere in this TSR).
