# Benchmark Reference — Databases & Vector Stores

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.4, §3.12

**Note on methodology:** directional figures from vendor documentation and commonly cited industry benchmarks, not AOS-measured.

## Relational (OLTP)

| Dimension                                  | PostgreSQL                       | MySQL                | CockroachDB                                    | YugabyteDB                                     |
| ------------------------------------------ | -------------------------------- | -------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Single-node write throughput (simple OLTP) | High                             | High                 | Medium (consensus overhead per write)          | Medium (consensus overhead per write)          |
| Multi-region write latency                 | N/A (needs external sharding)    | N/A                  | Higher (cross-region consensus), but automatic | Higher (cross-region consensus), but automatic |
| RLS enforcement overhead                   | Low (native, planner-integrated) | N/A (app-layer only) | Low (Postgres-compatible RLS)                  | Low (Postgres-compatible RLS)                  |
| Point-in-time recovery / backup maturity   | Very mature                      | Very mature          | Mature                                         | Maturing                                       |

**Relevance to AOS (§3.4):** the deciding factors were RLS maturity and pgvector compatibility, not raw single-node throughput, since Postgres and its distributed-SQL Postgres-wire-compatible relatives (CockroachDB/YugabyteDB) are all "high enough" for AOS's per-tenant transaction volume; CockroachDB's automatic multi-region consistency is valuable specifically for the small subset of Enterprise tenants requiring it, not the default tier.

## Vector Similarity Search

| Dimension                                                      | pgvector                                     | Qdrant                       | Weaviate | Milvus                                                                |
| -------------------------------------------------------------- | -------------------------------------------- | ---------------------------- | -------- | --------------------------------------------------------------------- |
| Query latency at moderate scale (single-digit-million vectors) | Good (HNSW index support in recent versions) | Very good                    | Good     | Very good (built for very large scale)                                |
| Operational complexity                                         | Lowest (same DB as OLTP)                     | Low (single binary)          | Medium   | Higher (distributed components: etcd, MinIO, Pulsar/Kafka dependency) |
| Metadata/tenant-payload filtering performance                  | Adequate                                     | Strong                       | Strong   | Strong                                                                |
| Scale ceiling before requiring architecture change             | Low-to-medium tens of millions               | High (hundreds of millions+) | High     | Very high (billions, built for it)                                    |

**Relevance to AOS (§3.12):** pgvector's operational simplicity (zero additional infrastructure) wins for the default tier where per-tenant embedding volume is moderate; Qdrant is the recommended escape hatch specifically because its filtering performance and single-binary operational model beat Milvus's higher operational complexity for AOS's actual scale need (thousands of tenants each with moderate embedding volume, not one tenant with billions of vectors).
