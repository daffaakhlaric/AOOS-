# Tech Stack Record — Cache

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.6
ADR: [`adr/ADR-TSR-006-cache.md`](../adr/ADR-TSR-006-cache.md)
Decision Matrix: [`decision-matrix/cache.md`](../decision-matrix/cache.md)

---

## 1. Objective

Choose the in-memory data store underlying AOS's Working Memory tier (Memory Contract, doc 003.5), rate-limit counters (API Gateway, Kong plugins, per-tenant fair-share queueing per Architecture ADR-011), session data, and — as decided in §3.7 — the backing store for the BullMQ job queue. This is a foundational, high-fan-in dependency: nearly every Core Runtime service touches the cache on the hot path.

## 2. Requirements

- Sub-millisecond p50 read/write latency for Working Memory reads on the Agent invocation hot path.
- Redis wire-protocol compatibility, so the platform is not locked to a single client library or vendor SDK (broad Node.js/Go/Python client support, per the Compatibility Matrix in the master TSR §6).
- Support for the data structures BullMQ and Working Memory need: strings, hashes, sorted sets (for rate-limit windows and delayed-job scheduling), pub/sub, and TTL-based expiry (session data, ephemeral Working Memory).
- A license that a commercial multi-tenant SaaS can build on indefinitely without legal exposure or a forced future renegotiation — this is a hard filter, not a soft preference (Constitution RULE on vendor lock-in and licensing risk).
- Acceptable operational profile for both a small early-stage team and eventual thousands-of-tenant scale (single-node simplicity now, clustering/replication headroom later).

## 3. Candidate Technologies

| Candidate            | Summary                                                                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redis** (post-7.4) | The reference implementation and origin of the protocol; now dual-licensed under RSALv2/SSPL by Redis Inc. as of the 2024 relicensing.                                                                                                                                              |
| **Valkey**           | Linux-Foundation-governed, BSD-3-Clause-licensed fork of Redis, created by the open-source community and major cloud vendors (AWS, Google Cloud, Oracle, and others) in direct response to the Redis relicensing. Protocol- and command-compatible fork at the point of divergence. |
| **DragonflyDB**      | A from-scratch, multi-threaded, shared-nothing reimplementation of the Redis/Memcached protocol surface, designed to exploit modern multi-core hardware far more fully than Redis/Valkey's single-threaded-per-shard core.                                                          |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best) for every dimension except **Vendor Lock-in Risk**, where 1 = highest risk and 5 = lowest risk (i.e., higher is always better across the whole table), and **Estimated Cost**, where 5 = lowest relative cost.

| Dimension                               | Redis (post-7.4)          | Valkey       | DragonflyDB          |
| --------------------------------------- | ------------------------- | ------------ | -------------------- |
| Performance                             | 4                         | 4            | 5                    |
| Scalability                             | 4                         | 4            | 4                    |
| Reliability                             | 5                         | 4            | 3                    |
| Security                                | 4                         | 4            | 4                    |
| Maintainability                         | 4                         | 4            | 3                    |
| Developer Experience                    | 5                         | 5            | 4                    |
| Ecosystem                               | 5                         | 4            | 3                    |
| Community Maturity                      | 5                         | 3            | 2                    |
| Licensing                               | 1                         | 5            | 2                    |
| Cloud Compatibility                     | 5                         | 5            | 4                    |
| Vendor Lock-in Risk                     | 2                         | 5            | 3                    |
| Estimated Cost                          | 4                         | 5            | 4                    |
| **Weighted relevance to §3.6 decision** | Disqualified on Licensing | **Selected** | Future Consideration |

## 5. Benchmark

See [`benchmarks/messaging-benchmarks.md`](../benchmarks/messaging-benchmarks.md) §"Cache" for the full directional comparison table (protocol compatibility, threading model, throughput-per-node, license). Per that file's stated methodology: figures are directional, drawn from vendor documentation and commonly reported industry benchmark categories, not AOS-measured — no AOS-specific load test has been run at this pre-implementation stage.

## 6. Performance

Redis and Valkey share the same single-threaded-core-per-shard architecture at the point of Valkey's fork, so their throughput/latency profile is effectively identical for AOS's near-term workload shapes. DragonflyDB's multi-threaded, shared-nothing design gives it a directional throughput-per-node advantage on multi-core hardware, particularly for read-heavy, high-connection-count workloads — this is the specific property that makes it the named future upgrade path, not a reason to adopt it now.

## 7. Scalability

All three scale horizontally via clustering/sharding (Redis Cluster protocol, which Valkey and DragonflyDB both remain compatible with). Valkey's scaling ceiling per node is the same as Redis's; DragonflyDB raises the per-node ceiling, meaning fewer, larger nodes can serve the same load — relevant primarily at the 10,000-dealer cost tier (§10 below).

## 8. Reliability

Redis has the longest production track record of the three by a wide margin. Valkey inherits Redis's battle-tested replication/persistence model (RDB/AOF) up to the fork point and has not diverged architecturally, so its reliability profile is a close proxy for Redis's, with the caveat of a shorter independent track record as its own project (flagged explicitly in Risk Register RISK-004). DragonflyDB's newer, from-scratch codebase carries more inherent unknown-unknowns despite strong published benchmarks.

## 9. Security

All three support TLS transport, ACL-based authentication, and standard network isolation (VPC/private subnet deployment). No material security differentiation among the three at the protocol level; the deciding dimension for this category is licensing, not security posture.

## 10. Maintainability

Valkey's command surface and operational runbooks are a near-1:1 continuation of pre-relicense Redis, meaning existing operational knowledge, monitoring integrations, and client libraries transfer directly (Risk Register RISK-004 mitigation). DragonflyDB's operational model is broadly Redis-protocol-compatible but not identical in every configuration/tuning surface, so runbook transfer is only partial.

## 11. Developer Experience

Effectively identical across all three at the client-library level — any Redis-protocol client (ioredis, node-redis, redis-py) works unmodified against Valkey and largely against DragonflyDB. No DX differentiator drives this decision.

## 12. Ecosystem

Redis has the deepest ecosystem (managed offerings from every major cloud, the widest module/tooling landscape). Valkey's ecosystem is younger as an independent brand but is directly underwritten by AWS, Google Cloud, and other major vendors now offering managed Valkey services, which meaningfully de-risks its long-term ecosystem trajectory. DragonflyDB's ecosystem (managed offerings, third-party tooling integrations) is the newest and thinnest of the three.

## 13. Community Maturity

Redis: longest-standing, largest community. Valkey: newly formed (2024) but Linux-Foundation-governed with major-vendor backing, which is a strong maturity signal for a young project even though its calendar age is short. DragonflyDB: smallest community of the three, single-vendor-driven (BSL licensing model reflects this).

## 14. Licensing

This is the decisive dimension for the Cache category and is stated explicitly per the task brief:

- **Redis (7.4+): RSALv2 (Redis Source Available License v2) / SSPL dual license.** Neither license is OSI-approved open source. RSALv2 restricts offering Redis "as a service" to end users in competition with Redis Inc.; SSPL has documented industry reluctance (e.g., major Linux distributions declining to package SSPL software) due to its "make your entire service stack's source available" trigger. For a commercial multi-tenant SaaS platform that may eventually offer a managed AOS tier, this is a direct, foreseeable legal exposure — not a hypothetical one.
- **Valkey: BSD-3-Clause**, governed by the Linux Foundation. Fully permissive, OSI-approved open source, with no "as a service" carve-out restriction and no copyleft trigger. This is the license-safe choice for AOS's stated principle (master TSR §1, guiding philosophy #2: "open, self-hostable, non-restrictively-licensed technology preferred").
- **DragonflyDB: Business Source License (BSL).** Source-available, converts to a fully open license after a time-delay period per version (a "eventually open" model), but is not permissively licensed at the current version at the time of evaluation, and — like Redis's RSALv2 — carries its own "as a service" competitive-use restriction. More permissive in practice than Redis's current terms, but not equivalent to Valkey's unconditional BSD-3-Clause.

## 15. Cloud Compatibility

All three are deployable on every major cloud (self-hosted on Kubernetes, or via managed offerings). Valkey specifically now has first-party managed-service support from AWS (ElastiCache for Valkey) and Google Cloud (Memorystore for Valkey), meaning the licensing-safe choice is also the one with the strongest emerging managed-cloud support — a rare case where the principled choice and the operationally convenient choice converge.

## 16. Vendor Lock-in

Valkey scores best on lock-in risk: Linux Foundation governance (not a single company) plus full protocol compatibility means a future migration off Valkey (to Redis, DragonflyDB, or elsewhere) requires only a configuration/endpoint change, not an application rewrite. Redis carries the highest lock-in-adjacent risk in the sense that its license terms are unilaterally set by a single commercial vendor with a demonstrated willingness to change them (the 2024 relicensing itself is the precedent). DragonflyDB is single-vendor-governed today, a middle risk position.

## 17. Estimated Cost

See [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §5: Valkey infrastructure is estimated at **$150–$300/mo at 100 dealers, $1,000–$2,000/mo at 1,000 dealers, and $6,000–$12,000/mo at 10,000 dealers**. These figures assume self-hosted-or-managed Valkey at standard node sizing with the 1.4x autoscaling headroom factor (cost model §1). DragonflyDB's higher throughput-per-node is explicitly the lever that would compress this line at the 10,000-dealer tier if adopted (cost model §11 observation), which is precisely why it is retained as the named future upgrade path rather than dismissed.

## 18. Pros

**Valkey:** BSD-3-Clause license eliminates licensing risk entirely; drop-in Redis-protocol compatibility means zero client-library or operational-runbook migration cost; Linux Foundation governance plus major-cloud-vendor backing gives strong confidence in long-term maintenance; first-party managed offerings already emerging from AWS/GCP.

## 19. Cons

**Valkey:** Younger as an independently-branded project (forked 2024) than Redis's decade-plus track record, meaning fewer years of independent production battle-testing under its own name, and a thinner (though rapidly growing) pool of engineers with hands-on Valkey-specific operational experience versus the much larger pool of Redis-experienced engineers (whose skills do transfer near-fully).

## 20. Trade-offs

Choosing Valkey over the objectively longer-track-record Redis accepts a modest maturity-as-an-independent-brand discount in exchange for eliminating a licensing risk that would otherwise sit under the platform's single most heavily-used piece of shared infrastructure (Working Memory + rate limiting + BullMQ backing store, all on the same cache). Given AOS's intent to potentially offer managed/hosted tiers in the future (where RSALv2's "as a service" restriction becomes directly and immediately relevant, not theoretical), this trade-off is clearly correct per the master TSR's guiding philosophy #2.

## 21. Final Recommendation

**Valkey** — matching the master TSR §3.6 verbatim: following Redis Inc.'s 2024 relicensing of Redis (7.4+) away from the permissive BSD-3-Clause license to the more restrictive RSALv2/SSPL dual license, Valkey (the Linux-Foundation-governed, BSD-licensed fork) is the licensing-safe, drop-in-compatible successor for a platform that intends to remain free to self-host and potentially offer managed tiers without license risk. **DragonflyDB is a Future Consideration**, not adopted now — its multi-threaded architecture offers a meaningfully higher throughput-per-node than single-threaded Redis/Valkey, which could reduce cache infrastructure cost at 10,000-dealer scale, but it is adopted only after Valkey is proven sufficient in production, avoiding two migrations in close succession.

## 22. ADR Reference

[`adr/ADR-TSR-006-cache.md`](../adr/ADR-TSR-006-cache.md)

## 23. Migration Strategy

Per [`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) §2, the named path is **Valkey → DragonflyDB**, triggered when "cache infrastructure cost or per-node throughput ceiling becomes a measured bottleneck at a specific tenant-scale checkpoint" (explicitly flagged against the 10,000-dealer cost tier). Because both speak the Redis wire protocol, the migration approach is the lowest-risk pattern in the entire migration table: stand up DragonflyDB alongside Valkey, shift traffic via configuration/endpoint change (no application-code change required, since access goes through standard Redis-protocol clients), validate latency and cache-hit-rate parity under real production traffic before full cutover, and keep Valkey available for rapid rollback during the soak period. This migration is explicitly capacity-triggered, not calendar-triggered (cost model §12).

## 24. Future Consideration

DragonflyDB remains under active observation as the throughput-per-node upgrade path once Valkey is operationally proven at AOS's own workload shape (Risk Register RISK-004 mitigation notes this explicitly). Re-evaluate DragonflyDB's own licensing terms at the time of any future migration decision — BSL license terms are version-scoped and may have shifted by the time the 10,000-dealer trigger is realistically reached (Year 3+ per `roadmap/technology-roadmap.md`).
