# Tech Stack Detail — Vector Database

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.12 · TSR Category 12 · ADR-TSR-012

**Status:** ACTIVE. This file expands, and does not alter, the Final Recommendation already made in TSR §3.12.

---

## 1. Objective

Choose the store for the Memory Contract's `SemanticMemory`/`VectorMemory` fields and the Knowledge Contract's `Embedding` field — i.e., the backing store for Agent long-term semantic recall and RAG-style Knowledge retrieval (doc 003.5 §8–9; Architecture §20–21).

## 2. Requirements

- Tenant-partitioned similarity search — every query must be scoped to a tenant (and, per DDD §25, potentially a Branch) without cross-tenant leakage risk at the vector-index layer, not just the application layer.
- Acceptable latency at RAG-query time — Agent inference is already latency-sensitive (Conversational AI in particular, TSR §4.1); retrieval must not dominate the end-to-end response budget.
- Operational simplicity where possible — consistent with TSR §1's cost-efficiency and "don't add infrastructure without a named justification" philosophy.
- Compatibility with the primary OLTP database decision (§3.4, PostgreSQL) where doing so avoids an unnecessary second database technology.
- A credible scale-up path for the minority of tenants/aggregate load that genuinely outgrows a simple default.

## 3. Candidate Technologies

| Candidate | Type                                       | Notes                                                                                     |
| --------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| pgvector  | PostgreSQL extension                       | Vector type + HNSW/IVFFlat indexing inside the existing OLTP database                     |
| Qdrant    | Purpose-built vector database              | Rust-based, single-binary, strong payload filtering                                       |
| Weaviate  | Purpose-built vector database              | Go-based, schema/class model, built-in modules (hybrid search, generative)                |
| Milvus    | Purpose-built, distributed vector database | Built for very large scale (billions of vectors); depends on etcd, MinIO/S3, Pulsar/Kafka |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best). Vendor Lock-in Risk and Estimated Cost score 5 = lowest risk / lowest cost.

| Dimension            | pgvector                                           | Qdrant                     | Weaviate                                                                  | Milvus                                                  |
| -------------------- | -------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| Performance          | 3 (good at moderate scale, HNSW available)         | 5                          | 4                                                                         | 5 (built for scale, adds overhead at small scale)       |
| Scalability          | 2 (single-node Postgres ceiling)                   | 4                          | 4                                                                         | 5                                                       |
| Reliability          | 4 (inherits Postgres's HA/backup maturity)         | 4                          | 4                                                                         | 3 (more moving distributed parts to fail)               |
| Security             | 4 (inherits Postgres RLS/auth model)               | 3 (own auth/API-key model) | 3                                                                         | 3                                                       |
| Maintainability      | 5 (no new database to operate)                     | 4 (single binary)          | 3 (schema/class model adds complexity)                                    | 2 (distributed deps: etcd, object store, message queue) |
| Developer Experience | 4 (same SQL client, familiar)                      | 4                          | 3                                                                         | 3                                                       |
| Ecosystem            | 3 (growing, Postgres-ecosystem-adjacent)           | 4                          | 4                                                                         | 4                                                       |
| Community Maturity   | 4 (Postgres itself very mature; extension younger) | 4                          | 4                                                                         | 4                                                       |
| Licensing            | 5 (PostgreSQL License, permissive)                 | 5 (Apache-2.0)             | 4 (BSL for some features, core Apache-2.0/BSD-mixed — verify per version) | 5 (Apache-2.0)                                          |
| Cloud Compatibility  | 5                                                  | 5                          | 5                                                                         | 4 (heavier footprint, less trivial to self-host well)   |
| Vendor Lock-in Risk  | 5 (standard Postgres extension)                    | 4                          | 4                                                                         | 4                                                       |
| Estimated Cost       | 5 (zero incremental infra at default tier)         | 3                          | 3                                                                         | 2 (heaviest infra footprint)                            |

## 5. Benchmark

Directional only — no AOS-run benchmark exists. Industry-reported and vendor-documented patterns: pgvector with HNSW indexing performs "good" at single-digit-million-vector scale per dataset/index-tuning, with recall/latency trade-offs tunable via `ef_search`; Qdrant and Milvus, purpose-built for vector workloads, generally report materially lower p95 query latency at large vector counts (tens of millions+) in published benchmarks, with Milvus explicitly engineered for billion-scale collections. These are directional industry patterns, not AOS-measured figures — see `benchmarks/database-benchmarks.md` §"Vector Similarity Search" for the source comparison table this section is grounded in.

## 6. Performance

For AOS's actual near-term workload shape — thousands of tenants, each with a moderate (not billion-scale) embedding volume per the cost model's ~500MB/dealer vector-storage assumption — pgvector's performance is "adequate," not best-in-class, which is the deliberately accepted trade-off: optimizing for a scale AOS does not yet have would be premature infrastructure investment (TSR §1 philosophy point 1, multi-tenant cost efficiency over raw peak performance). Qdrant is reserved for the specific tenants/aggregate load where this stops being true.

## 7. Scalability

pgvector inherits Postgres's fundamentally single-primary-node ceiling for a given tenant/shared-tier's vector workload (mitigated somewhat by read replicas for read-heavy RAG queries, but write/index-maintenance scaling remains single-node-bound). Qdrant's clustering model scales horizontally by design and is the explicit escape hatch once this ceiling is reached for a given tenant or in aggregate. Milvus scales further still but at materially higher operational complexity than AOS's near-term need justifies.

## 8. Reliability

pgvector benefits from Postgres's decades of production HA/backup/PITR maturity — a genuine reliability advantage over any of the purpose-built alternatives, none of which have an equivalently long production track record. Qdrant's single-binary model is operationally simple to reason about for HA (fewer moving parts than Milvus). Milvus's distributed dependency chain (etcd for metadata, MinIO/S3-compatible object storage for data, Pulsar/Kafka for messaging) means more independent failure domains to keep healthy simultaneously — each individually mature, but the composition adds operational surface pgvector and Qdrant do not have.

## 9. Security

pgvector inherits Postgres's native Row-Level Security (§3.4) directly — the same per-tenant RLS session-variable scoping (`SET LOCAL app.tenant_id`) already governing every other table governs vector rows too, with no separate tenant-isolation mechanism to build, test, and audit. Qdrant's tenant isolation instead relies on its own payload-filtering mechanism (filtering by a `tenant_id` field at query time) — strong and performant, per `benchmarks/database-benchmarks.md`, but a second isolation model to reason about and verify, distinct from the RLS model DDD §25 establishes as the platform default.

## 10. Maintainability

pgvector is the clear winner: zero additional database technology to patch, back up, monitor, or staff for, for the default tier. Qdrant adds one more operationally simple service. Weaviate's schema/class model and module system add conceptual surface. Milvus's multi-component distributed architecture is the most maintenance-intensive of the four by a wide margin, which is precisely why it is not recommended even as the escape hatch (Qdrant fills that role instead).

## 11. Developer Experience

pgvector's DX advantage is structural: the same SQL client, the same connection pool, the same Drizzle-based data-access layer (§3.5) used for every other table can be used for vector columns and similarity queries (`<->`/`<=>` operators), with no second client library or query language to learn. Qdrant's REST/gRPC client is well-documented and straightforward but is still a second API surface engineers must learn.

## 12. Ecosystem

Qdrant, Weaviate, and Milvus each have more vector-database-specific tooling (dedicated dashboards, LangChain/LlamaIndex-style integrations, managed cloud offerings) than pgvector's comparatively thinner vector-specific ecosystem — though pgvector benefits from the vastly larger general PostgreSQL ecosystem for everything except the vector-specific tooling itself.

## 13. Community Maturity

PostgreSQL itself is one of the most mature open-source projects in existence; the `pgvector` extension specifically is younger but under active development and widely adopted quickly given Postgres's existing installed base. Qdrant, Weaviate, and Milvus each have healthy, growing, venture-backed open-source communities of comparable maturity to one another at this writing.

## 14. Licensing

pgvector: PostgreSQL License (permissive, effectively BSD/MIT-class). Qdrant: Apache-2.0. Milvus: Apache-2.0. Weaviate: mixed — core is open-source (BSD-3-Clause per its published license at time of writing) with some enterprise features gated separately; this nuance is exactly why Weaviate is not the recommended escape hatch even though it scores competitively elsewhere — Qdrant's simpler, unambiguous Apache-2.0 licensing posture is preferred, applying the same licensing-clarity reasoning as the Redis→Valkey (§3.6) and Elasticsearch→OpenSearch (§3.14) decisions.

## 15. Cloud Compatibility

All four are deployable on Kubernetes (self-hosted or via managed/cloud-marketplace offerings), consistent with Architecture §11's single deployment topology. pgvector requires no additional cloud compatibility work beyond what PostgreSQL (§3.4) already requires. Milvus's heavier dependency chain (etcd, object storage, messaging) makes it the least trivial of the four to stand up cleanly across arbitrary cloud environments, though it remains fully supportable.

## 16. Vendor Lock-in

pgvector carries the lowest lock-in risk of the four — it is a standard, widely-adopted Postgres extension, and "migrating away" from it is really just "stop using this extension on the database you already run," not a separate vendor relationship to unwind. Qdrant, as an Apache-2.0-licensed, self-hostable product with a well-defined API, also carries low lock-in risk; the escape-hatch pattern (§3.4, §3.6, §3.12, §3.13 all share this shape) is specifically designed so that "default + escape hatch" never becomes "default + one-way door."

## 17. Estimated Cost

See [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §7. At 100 dealers, vector database cost is **included within the Database line** (no incremental infrastructure — pgvector runs inside the already-provisioned Postgres instance). At 1,000 dealers, a Qdrant slice begins at an estimated **$500–$1,200/mo** as the escape hatch activates for qualifying tenants/aggregate load. At 10,000 dealers, this grows to an estimated **$5,000–$10,000/mo**. This cost curve is the direct financial expression of the "start simple, escape-hatch when proven necessary" pattern — Milvus's heavier footprint would front-load infrastructure cost the platform does not yet need at 100-dealer scale.

## 18. Pros

- pgvector: zero incremental infrastructure, native RLS-based tenant isolation, single SQL client, PostgreSQL-grade backup/HA maturity.
- Qdrant: strong tenant-payload filtering performance, single-binary operational simplicity, unambiguous Apache-2.0 licensing, credible horizontal scale path.

## 19. Cons

- pgvector: single-node ceiling for a given tenant/tier's write and index-maintenance throughput; less specialized query performance than purpose-built vector databases at large scale.
- Qdrant: a second database technology to operate (even if operationally simple), a second tenant-isolation model to verify distinct from RLS, and incremental infrastructure cost once activated.

## 20. Trade-offs

Running two vector stores (pgvector default + Qdrant for scale) instead of one is more operational surface than a single-technology answer, accepted for the same "start simple, escape-hatch when proven necessary" reasoning already applied to Database (§3.4) and Cache (§3.6, forward-looking to DragonflyDB). The alternative — mandating Qdrant (or Milvus) for every tenant regardless of embedding volume — would front-load infrastructure cost and operational burden the majority of tenants do not need, which directly contradicts TSR §1 point 1 (multi-tenant cost efficiency over raw peak performance).

## 21. Final Recommendation

**pgvector** as the default — since PostgreSQL (§3.4) is already the primary OLTP store, using its `pgvector` extension for the shared/default tenant tier means one fewer database technology to operate, and its performance is adequate for the majority of tenants' embedding volume. **Qdrant recommended as the Enterprise/scale escape hatch** — once a tenant's (or the platform's aggregate) embedding volume/query load exceeds what pgvector comfortably serves, Qdrant is the migration target: chosen over Weaviate and Milvus for its simpler single-binary operational model, strong metadata/tenant-payload filtering performance (directly useful for tenant isolation at the vector-query level), and lighter resource footprint than Milvus's more complex distributed architecture. This matches, without alteration, the Final Recommendation already made in TSR §3.12.

## 22. ADR Reference

[`adr/ADR-TSR-012-vector-database.md`](../adr/ADR-TSR-012-vector-database.md)

## 23. Migration Strategy

Per `migration/migration-and-upgrade-strategy.md`: trigger condition is aggregate embedding volume or RAG query p95 latency crossing a defined threshold (measured against real Year-1 production data, not pre-guessed at TSR-writing time). Migration approach: dual-write embeddings to both pgvector and Qdrant during a soak period, shadow-read comparison for retrieval-quality parity, cut over read traffic tenant-by-tenant (not a platform-wide big-bang cutover), decommission pgvector rows only after a full retention-window safety margin has passed.

## 24. Future Consideration

- Re-evaluate Milvus specifically if a future Enterprise tenant's embedding volume genuinely approaches billion-vector scale — a scenario the current tenant profile does not anticipate but which the escape-hatch pattern does not foreclose.
- Track pgvector's own performance roadmap (HNSW/index improvements land in most PostgreSQL major releases at time of writing) — each improvement raises the threshold at which the Qdrant escape hatch needs to trigger, directly reducing infrastructure cost at scale.
- Monitor Weaviate's licensing posture over time; if it fully converges on a single unambiguous permissive license, it becomes worth re-scoring as an escape-hatch alternative to Qdrant.
