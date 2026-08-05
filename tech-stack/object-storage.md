# Tech Stack Detail — Object Storage

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.13 · TSR Category 13 · ADR-TSR-013

**Status:** ACTIVE. This file expands, and does not alter, the Final Recommendation already made in TSR §3.13.

---

## 1. Objective

Choose the S3-API-compatible object storage layer for Content/Creative assets, Knowledge documents, and platform backups.

## 2. Requirements

- S3-API compatibility as a hard baseline — every client library, CDN integration, and future tooling choice should target one stable protocol regardless of the underlying provider (this is what makes the vendor-lock-in mitigation in §16 possible at all).
- Cost model favorable to AOS's actual access pattern: assets read frequently by both Agents at inference time (RAG grounding, Content Contract lifecycle) and CDN-served Dashboard/customer-facing surfaces — an access pattern that is read-heavy and egress-heavy, not just storage-heavy.
- Data-residency and on-prem/self-hosted options for Enterprise tenants with contractual or regulatory constraints (Architecture §32 DR/residency considerations).
- Durability and availability consistent with backups and Knowledge documents being business-critical, not disposable, data.

## 3. Candidate Technologies

| Candidate     | Type                                                   | Notes                                                               |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| MinIO         | Self-hosted, S3-API-compatible object storage          | Open-source, single-binary-per-node, run anywhere including on-prem |
| Amazon S3     | Managed, cloud-native object storage (AWS)             | The original S3 API; deep AWS ecosystem integration                 |
| Cloudflare R2 | Managed, S3-API-compatible object storage (Cloudflare) | Zero egress fees; global network                                    |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best). Vendor Lock-in Risk and Estimated Cost score 5 = lowest risk / lowest cost.

| Dimension            | MinIO                                                                                    | Amazon S3                                               | Cloudflare R2                                                                |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Performance          | 3 (depends on self-hosted infra quality)                                                 | 5                                                       | 4                                                                            |
| Scalability          | 3 (scales with operator-managed cluster size)                                            | 5                                                       | 5                                                                            |
| Reliability          | 3 (operator-owned durability/replication)                                                | 5 (11 nines-class published durability)                 | 4 (strong, shorter public track record than S3)                              |
| Security             | 4 (full operator control, IAM-compatible policies)                                       | 5 (mature IAM, encryption, compliance certifications)   | 4 (solid, smaller compliance-certification catalog than AWS at this writing) |
| Maintainability      | 2 (self-operated: patching, capacity, HA)                                                | 5 (fully managed)                                       | 5 (fully managed)                                                            |
| Developer Experience | 4 (S3-API compatible, familiar tooling)                                                  | 5 (largest tooling/SDK ecosystem)                       | 4 (S3-API compatible, growing tooling)                                       |
| Ecosystem            | 3                                                                                        | 5 (largest of any object storage provider)              | 4 (growing quickly, backed by Cloudflare's broader platform)                 |
| Community Maturity   | 4                                                                                        | 5                                                       | 3 (younger product)                                                          |
| Licensing            | 4 (AGPLv3 for MinIO server — copyleft, notable for self-hosted redistribution scenarios) | 5 (N/A, managed service)                                | 5 (N/A, managed service)                                                     |
| Cloud Compatibility  | 5 (runs anywhere, including air-gapped)                                                  | 4 (AWS-native; usable elsewhere via API only)           | 5 (works from any cloud/edge via API)                                        |
| Vendor Lock-in Risk  | 5 (self-hosted, zero vendor dependency)                                                  | 3 (AWS-specific pricing/egress; API itself is portable) | 4 (S3-API-compatible, but Cloudflare-specific account/billing relationship)  |
| Estimated Cost       | 3 (infra + ops labor cost, no metered fees)                                              | 2 (egress fees compound at AOS's read-heavy pattern)    | 5 (zero egress fees — directly favorable to AOS's access pattern)            |

## 5. Benchmark

Directional only. Published provider documentation and widely reported patterns: Amazon S3's per-request/storage pricing is well understood and its durability/availability SLAs are among the most established in the industry; Cloudflare R2's defining, publicly marketed characteristic is **zero egress fees**, a structural pricing difference (not a raw throughput claim) from S3's standard egress-metered model; MinIO's performance is a function of the operator's own hardware/network provisioning, not a fixed vendor-published number, since it is self-hosted software rather than a managed service — see `benchmarks/database-benchmarks.md` for the sibling database-benchmark methodology note (no proprietary AOS benchmarking exists yet).

## 6. Performance

For CDN-fronted asset delivery and Agent-time RAG document retrieval, all three candidates are "high enough" in raw throughput/latency terms for AOS's workload; the deciding factors for this category are cost structure and operational model, not raw performance differentiation, consistent with the pattern already established for Database (§3.4) and Vector Database (§3.12) where "adequate performance at acceptable cost" beats "peak performance at higher cost/operational burden."

## 7. Scalability

Amazon S3 and Cloudflare R2 both scale effectively without operator intervention (a defining property of hyperscale-managed object storage). MinIO's scalability is bounded by the operator's own cluster capacity planning — entirely workable for the self-hosted/dev/CI use case it is recommended for (§21), but not the reason it would be chosen for the platform's primary production tier.

## 8. Reliability

Amazon S3's durability/availability track record is the longest and most independently verified of the three. Cloudflare R2 is built on Cloudflare's global network and offers strong, published durability guarantees, with a shorter public production track record than S3's. MinIO's reliability is entirely a function of how well the operator deploys and maintains it (erasure coding, multi-node distribution, backup discipline) — appropriate and controllable for the specific self-hosted/on-prem/data-residency scenarios it is recommended for, not treated as a like-for-like reliability peer to the two managed options for the platform's default production tier.

## 9. Security

All three support encryption at rest/in transit and IAM-style access policies. Amazon S3 has the deepest compliance-certification catalog (relevant for Enterprise tenants with specific regulatory requirements) at this writing. MinIO's security posture is entirely operator-controlled, which is a genuine advantage for Enterprise tenants requiring full physical/data-residency control (Architecture §32) and a genuine burden for a small team expected to configure it correctly without a vendor's default hardening.

## 10. Maintainability

This is where the managed options (S3, R2) clearly win over MinIO: no patching, capacity planning, or HA-cluster operations burden. This is precisely why MinIO is scoped to self-hosted/dev/CI and specific on-prem-Enterprise-residency cases rather than recommended as the platform's default production tier — Constitution §2's simplicity bias favors not taking on unmanaged infrastructure operations where a managed equivalent meets the requirement.

## 11. Developer Experience

All three speak the S3 API, so the same client SDKs, the same request-signing model, and largely the same tooling work across all three with only endpoint/credential configuration changes — this uniformity is the direct enabler of the low vendor-lock-in posture described in §16, not an incidental convenience.

## 12. Ecosystem

Amazon S3's ecosystem (SDKs, third-party integrations, CDN/edge-compute pairings, IaC provider support) is the largest and most mature of the three by a wide margin, an expected consequence of being the original and longest-established S3-API provider. Cloudflare R2's ecosystem is growing quickly, aided by its S3-API compatibility (any S3-ecosystem tool works against it with a configuration change) and Cloudflare's broader developer platform (Workers, CDN) which pairs naturally with R2 for the Dashboard/CDN-served asset use case.

## 13. Community Maturity

MinIO and Amazon S3 are both long-established, high-maturity projects/services. Cloudflare R2 is the youngest of the three as a product, though Cloudflare itself is a mature, well-resourced organization, mitigating the typical risk profile of a "young product."

## 14. Licensing

MinIO's server is licensed under **AGPLv3** (a copyleft license) — a materially different licensing posture than a permissive license, worth flagging explicitly: AGPLv3's network-use copyleft provisions are a consideration if AOS were to modify and redistribute MinIO's server code as part of a hosted offering, though simply _running_ MinIO as internal infrastructure (the recommended use here — self-hosted/dev/CI/on-prem-Enterprise) does not trigger redistribution obligations. Amazon S3 and Cloudflare R2 are managed services with no applicable open-source license question for AOS as a consumer.

## 15. Cloud Compatibility

MinIO's defining advantage is running anywhere, including fully air-gapped on-prem environments — the only one of the three candidates that can satisfy a data-residency requirement with zero public-cloud dependency at all. Amazon S3 is AWS-native (usable from other clouds only via its API over the network, not deployable elsewhere). Cloudflare R2 is accessible from any cloud or edge location via its S3-compatible API and Cloudflare's global network, without being tied to a single hyperscaler's compute environment.

## 16. Vendor Lock-in

**This is the dimension most material to this category's decision**, more so than for most other TSR categories, because object storage sits underneath every Content/Creative asset, every Knowledge document, and every backup the platform holds — a genuinely difficult thing to migrate under time pressure if the storage layer were proprietary. The reason R2 is adoptable as the default despite being a single-vendor (Cloudflare) managed service is that **its API is S3-compatible** — every application-level integration point (SDK calls, presigned URLs, multipart upload logic) is written against the S3 protocol, not against a Cloudflare-proprietary API. A future migration to raw Amazon S3, MinIO, or any other S3-API-compatible provider requires only an endpoint/credential/configuration change, not an application-code rewrite. This is qualitatively different from, say, a proprietary database API or a closed SaaS platform with no portable interface — the lock-in risk that would normally apply to "standardizing on one managed vendor" is structurally mitigated by protocol portability, which is exactly why R2 is an acceptable default under TSR §1 point 2 (avoid vendor lock-in wherever the operational burden of avoiding it is acceptable) rather than a violation of it. `risk/risk-register.md` RISK-008 tracks this explicitly and names a periodic migration-drill validation as the ongoing mitigation, since the S3-compatibility assumption should be verified in practice, not just assumed in theory.

## 17. Estimated Cost

See [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §8. R2's zero-egress-fee model is the direct driver of its cost line being dominated by storage volume (~5GB/dealer assumption) rather than access frequency: **$50–$150/mo** at 100 dealers, **$500–$1,200/mo** at 1,000 dealers, **$4,000–$8,000/mo** at 10,000 dealers. Amazon S3's standard egress-fee model would scale materially worse against AOS's actual access pattern (Agents reading Knowledge documents at inference time, Dashboard/CDN-served assets, both high-frequency-read scenarios) — this cost delta at 10,000-dealer scale is the deciding factor behind R2 as default rather than S3.

## 18. Pros

- Cloudflare R2 (default): zero egress fees materially favorable to AOS's read-heavy access pattern; S3-API-compatible, keeping switching cost low; fully managed.
- Amazon S3 (fallback): deepest compliance-certification catalog and longest production track record, valuable for AWS-standardized Enterprise tenants.
- MinIO (self-hosted/dev/CI/on-prem): the only option satisfying a zero-public-cloud data-residency requirement; no per-request or egress metering.

## 19. Cons

- Cloudflare R2: smaller compliance-certification catalog than AWS at this writing; younger product with a shorter public production track record; introduces a single-vendor (Cloudflare) operational dependency for the platform's primary object storage.
- Amazon S3: egress fees compound unfavorably against AOS's specific read-heavy, high-frequency-access pattern at scale.
- MinIO: full operational burden (patching, capacity, HA) sits with AOS's own team; AGPLv3 licensing requires care if AOS ever modifies and redistributes the server code.

## 20. Trade-offs

Standardizing on R2 as the default introduces a Cloudflare dependency for the platform's primary object storage layer. This is mitigated, not eliminated, by the S3-compatible API meaning a future migration to raw S3 or another S3-compatible provider requires no application-code change, only a configuration/credentials change — the trade-off is explicitly accepted on that basis, not glossed over, and is tracked as an open risk (`risk/risk-register.md` RISK-008) with a named periodic-validation mitigation rather than an assumption treated as permanently true without re-checking.

## 21. Final Recommendation

**Cloudflare R2** as the default for production — its zero-egress-fee model is directly cost-material for AOS's access pattern (Content/Creative assets and Knowledge documents are read frequently by both Agents at inference time and CDN-served Dashboard/customer-facing surfaces, and egress fees on S3 scale unfavorably with that pattern at thousands-of-tenant volume). **Amazon S3 retained as the fallback/enterprise option** for tenants with a specific cloud-residency or AWS-ecosystem-integration requirement (e.g., an Enterprise tenant already standardized on AWS). **MinIO recommended for self-hosted/dev/CI environments** and as the on-prem option for data-residency-constrained Enterprise tenants who cannot use any public cloud object store (Architecture §32 DR/residency considerations). This matches, without alteration, the Final Recommendation already made in TSR §3.13.

## 22. ADR Reference

[`adr/ADR-TSR-013-object-storage.md`](../adr/ADR-TSR-013-object-storage.md)

## 23. Migration Strategy

Object Storage is not a named entry in `migration/migration-and-upgrade-strategy.md`'s "default + escape hatch" table (that table covers Database, Vector DB, Event Bus, Cache, Workflow Engine, and API Gateway) because the S3-API-compatibility property means the R2→S3 (or R2→MinIO, or S3→R2) path is not a data-model migration in the same sense as, say, pgvector→Qdrant — it is a credentials/endpoint reconfiguration plus a bulk object-copy operation. The relevant discipline instead is the periodic migration-drill validation named in `risk/risk-register.md` RISK-008: actually rehearsing a bucket-to-bucket copy and endpoint cutover against a non-production environment on a recurring cadence, so the "S3-compatible = low switching cost" assumption is continuously verified rather than taken permanently on faith.

## 24. Future Consideration

- Periodically re-validate R2's compliance-certification catalog against Enterprise tenant requirements as it matures — if it converges with S3's at a given point, the case for defaulting Enterprise tenants to S3 specifically for compliance reasons weakens further.
- Track Cloudflare R2's own SLA/availability track record as it accumulates production history; if it does not hold up at scale, the S3 fallback is already a proven, low-friction path per §16 rather than a hypothetical one.
- Evaluate whether a specific class of Enterprise tenant (e.g., highly regulated verticals) warrants a standing MinIO-based on-prem offering as a productized option rather than a case-by-case exception.
