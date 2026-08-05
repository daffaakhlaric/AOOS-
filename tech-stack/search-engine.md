# Tech Stack Detail — Search Engine

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.14 · TSR Category 14 · ADR-TSR-014

**Status:** ACTIVE. This file expands, and does not alter, the Final Recommendation already made in TSR §3.14.

---

## 1. Objective

Choose the search technology for Dashboard/CRM/Knowledge full-text search — tenant-facing product search (lead/customer/inventory lookup, CRM record search), not the platform's analytics/aggregation engine (which is a separate, already-established concern per Architecture §22).

## 2. Requirements

- Fast, relevance-tuned-out-of-the-box full-text and typo-tolerant search, appropriate for a Dashboard/CRM lookup feature, not an analytics workload.
- Resource footprint appropriate for a supporting feature, not the platform's primary data store.
- Multi-tenant index isolation compatible with DDD §25's tenant-isolation model.
- Acceptable, unambiguous open-source licensing for a commercial multi-tenant SaaS — the same licensing-risk lens already applied to Cache (§3.6, Redis→Valkey).

## 3. Candidate Technologies

| Candidate     | Type                                | License at time of writing                                                                                       |
| ------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Elasticsearch | Full-text/analytics search engine   | **Elastic License v2 / SSPL** (dual-licensed, not fully open source since the 2021 relicensing)                  |
| OpenSearch    | Elasticsearch-derived fork          | **Apache-2.0** (AWS/Linux-Foundation-adjacent fork, created specifically in response to the Elastic relicensing) |
| Meilisearch   | Purpose-built product-search engine | **MIT**                                                                                                          |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best). Vendor Lock-in Risk and Estimated Cost score 5 = lowest risk / lowest cost.

| Dimension            | Elasticsearch                                                                                                                         | OpenSearch                                                                      | Meilisearch                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Performance          | 5 (mature, highly tunable)                                                                                                            | 5 (near-identical to Elasticsearch at fork point, diverging since)              | 4 (excellent for its scope; not built for large-scale analytics aggregation) |
| Scalability          | 5                                                                                                                                     | 5                                                                               | 3 (built for product-search scale, not log/analytics-grade volume)           |
| Reliability          | 5 (long production track record)                                                                                                      | 4 (strong, shorter independent track record post-fork)                          | 4 (solid for its intended scope)                                             |
| Security             | 4 (mature, some security features gated to paid tiers)                                                                                | 4 (comparable feature set, fully open)                                          | 3 (simpler security model, adequate for its scope)                           |
| Maintainability      | 2 (heavy: JVM tuning, cluster/shard management, significant ops expertise)                                                            | 2 (same operational profile as Elasticsearch — it is the same codebase lineage) | 5 (single binary, minimal configuration, low operational burden)             |
| Developer Experience | 3 (powerful but complex query DSL)                                                                                                    | 3 (same DSL)                                                                    | 5 (simple API, fast relevance out of the box, minimal tuning needed)         |
| Ecosystem            | 5 (largest search ecosystem, huge plugin/integration catalog)                                                                         | 4 (inherits most of Elasticsearch's ecosystem, AWS-native tooling)              | 3 (smaller but growing, focused product-search ecosystem)                    |
| Community Maturity   | 5                                                                                                                                     | 4 (younger as an independent project, backed by AWS/Linux Foundation)           | 3 (younger project, active and growing)                                      |
| Licensing            | 2 (SSPL/Elastic License — not OSI-approved open source; real risk for a commercial self-hosted-or-managed SaaS building on top of it) | 5 (Apache-2.0, fully OSI-approved, unambiguous)                                 | 5 (MIT, fully permissive)                                                    |
| Cloud Compatibility  | 5                                                                                                                                     | 5                                                                               | 5                                                                            |
| Vendor Lock-in Risk  | 3 (query DSL and operational patterns are transferable but the license itself is a form of lock-in risk)                              | 5 (Apache-2.0, self-hostable anywhere, no licensing-driven lock-in)             | 5 (MIT, self-hostable anywhere)                                              |
| Estimated Cost       | 2 (heaviest infra + ops-labor footprint of the three)                                                                                 | 2 (same operational cost profile as Elasticsearch)                              | 5 (lowest infra + ops footprint by a wide margin)                            |

## 5. Benchmark

Directional only. Elasticsearch and OpenSearch, sharing a common codebase lineage from the 2021 fork point, perform comparably on core full-text query latency/throughput in most published comparisons, with feature divergence (not raw performance divergence) growing over time as each project develops independently. Meilisearch is explicitly positioned and benchmarked by its maintainers against product-search use cases (typo tolerance, instant-search-as-you-type relevance) rather than large-scale log/analytics aggregation — a different benchmark category entirely, not a worse score on the same one. No AOS-run benchmark exists for any of the three.

## 6. Performance

For AOS's actual use case — Dashboard lead/customer/inventory search and CRM lookup, a bounded, feature-scoped search surface, not the platform's primary analytics engine (Architecture §22 Analytics Warehouse already owns that) — Meilisearch's out-of-box relevance tuning and low-latency instant-search characteristics are well matched to the requirement without needing Elasticsearch/OpenSearch's much larger tunable-parameter surface, which exists to serve workloads AOS is not asking this category to serve.

## 7. Scalability

Elasticsearch and OpenSearch both scale to very large document/log volumes via sharding and clustering — genuinely necessary capability for large-scale observability/analytics-grade search, which is exactly why OpenSearch is the named future upgrade path once/if AOS's search surface grows into that shape. Meilisearch scales well within its intended product-search scope but is not designed for the same order-of-magnitude document volume; this is a scoped, accepted limitation (§20 Trade-offs), not an oversight.

## 8. Reliability

Elasticsearch has the longest independent production track record of the three. OpenSearch, forked from a mature Elasticsearch codebase in 2021, inherited substantial production maturity at the fork point and has continued to harden independently since, backed by AWS and the OpenSearch Software Foundation. Meilisearch is reliable within its scoped use case; it is not positioned, and is not being selected here, as a system-of-record-grade store — the Dashboard/CRM search index is a derived, rebuildable view over the primary Postgres data (§3.4), not a source of truth, which materially lowers the reliability bar this category needs to clear.

## 9. Security

Elasticsearch and OpenSearch both offer mature security feature sets (RBAC, encryption, audit logging); notably, several of Elasticsearch's security features are gated to its paid/Enterprise tiers, whereas OpenSearch ships the equivalent functionality fully open — a second, security-specific expression of the same licensing-posture difference discussed in §14. Meilisearch's security model is simpler (API-key-scoped access, tenant-index separation) and adequate for a supporting search feature that is not the tenant-isolation boundary of record (RLS-governed Postgres remains that boundary, §3.4).

## 10. Maintainability

Elasticsearch and OpenSearch share the same operationally heavy profile: JVM tuning, shard/cluster capacity planning, and meaningful operational expertise to run well at any scale — a real cost, which is precisely why neither is the default recommendation for a supporting Dashboard feature. Meilisearch's single-binary, low-configuration operational model is the deciding maintainability advantage for the default choice, directly consistent with TSR §1 point 1 (multi-tenant cost efficiency over raw peak capability) applied to a feature that is not the platform's primary data store.

## 11. Developer Experience

Meilisearch's API and relevance model are deliberately simple — sensible ranking rules apply automatically, with minimal tuning required to get good results for typical lead/customer/inventory search queries. Elasticsearch/OpenSearch's Query DSL is powerful but has a materially steeper learning curve, appropriate for a team building a dedicated analytics/search product, not proportionate to a supporting CRM-lookup feature.

## 12. Ecosystem

Elasticsearch's ecosystem (Kibana, Beats, the broader Elastic Stack, third-party integrations) is the largest and most mature of the three. OpenSearch inherits most of this ecosystem value at the fork point and adds AWS-native tooling, though its independent ecosystem growth trails Elasticsearch's on some newer features. Meilisearch's ecosystem is smaller and more narrowly focused on product/instant-search integrations (client SDKs, framework connectors), proportionate to its narrower scope.

## 13. Community Maturity

Elasticsearch has the longest-established community. OpenSearch, now several years post-fork with dedicated Linux Foundation governance (OpenSearch Software Foundation) and AWS backing, has matured into an independent, well-resourced community rather than a thin fork. Meilisearch's community is smaller and younger but active and growing, consistent with a newer, more narrowly scoped product.

## 14. Licensing

This is the deciding dimension for the Elasticsearch-vs-OpenSearch half of this category, and it must be stated explicitly and precisely: **Elasticsearch, since its 2021 relicensing, ships under a dual Elastic License v2 / Server Side Public License (SSPL) model — neither of which is an OSI-approved open-source license.** This is the same category of licensing risk already named for Redis's 2024 relicensing (TSR §3.6, Redis→Valkey) — a platform that intends to remain freely self-hostable and potentially offer managed tiers without license-risk exposure should not build a core capability on a non-OSI license where a fully open alternative exists. **OpenSearch is that alternative**: forked specifically in response to the Elastic relicensing, licensed under **Apache-2.0**, an unambiguous, OSI-approved permissive license with no SSPL-style restrictions on how the software may be offered as a service. Meilisearch's **MIT** license is likewise fully permissive and licensing-risk-free. This TSR does not recommend building on Elasticsearch for that reason, mirroring the Valkey decision's reasoning exactly.

## 15. Cloud Compatibility

All three are deployable on Kubernetes (self-hosted or via managed offerings), consistent with Architecture §11. No candidate is disqualified or differentiated on this dimension.

## 16. Vendor Lock-in

Meilisearch (MIT) and OpenSearch (Apache-2.0) both carry low lock-in risk as fully open, self-hostable, unambiguously licensed software. Elasticsearch's licensing itself is a form of lock-in risk distinct from the usual "hard to migrate data out" concern — SSPL's terms specifically constrain how the software may be offered as a hosted/managed service, a constraint that does not exist for OpenSearch or Meilisearch. Query-DSL-level lock-in (queries written against Elasticsearch's specific DSL) is a secondary, more conventional lock-in concern shared to some degree by OpenSearch given the common lineage, mitigated by OpenSearch's close API compatibility with Elasticsearch easing any future migration between the two forks specifically.

## 17. Estimated Cost

See [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md). Search Engine is not broken out as an independent top-level line in the cost model's summary table (§11) — its infrastructure cost is scoped within the general Compute Infrastructure line given Meilisearch's lightweight, single-binary footprint, which is itself a direct cost consequence of this category's recommendation: choosing Elasticsearch/OpenSearch instead would have required its own explicitly budgeted, materially larger line item (JVM-heavy, multi-node clustering) that the current recommendation deliberately avoids needing.

## 18. Pros

- Meilisearch: dramatically lower operational overhead than Elasticsearch/OpenSearch, fast relevance-tuned-out-of-the-box results, MIT-licensed, resource footprint appropriate to a supporting feature.
- OpenSearch (future upgrade path): Apache-2.0-licensed, near-full Elasticsearch feature/API parity, AWS/Linux-Foundation-backed, no SSPL-style licensing risk.

## 19. Cons

- Meilisearch: no native large-scale aggregation/analytics engine; not designed for very large document/log volumes.
- OpenSearch: same heavy operational profile (JVM tuning, cluster/shard management) as Elasticsearch — the upgrade path trades Meilisearch's operational simplicity for analytics-grade capability, not a free improvement.
- Elasticsearch (rejected as a build target): SSPL/Elastic License is a real, structural licensing-risk exposure for a commercial multi-tenant SaaS, independent of its technical merits.

## 20. Trade-offs

Meilisearch's feature set is narrower than Elasticsearch/OpenSearch's — no native aggregation/analytics engine — accepted because AOS's Analytics needs are already served by the dedicated Analytics Warehouse (Architecture §22), not by the search engine. Search and Analytics are deliberately different systems for different jobs in this architecture; conflating them by choosing an analytics-grade search engine for what is actually a CRM-lookup feature would be over-provisioning against TSR §1 point 1.

## 21. Final Recommendation

**Meilisearch** for tenant-facing product search (Dashboard lead/customer/inventory search, CRM lookup) — dramatically lower operational overhead than Elasticsearch/OpenSearch, fast relevance-tuned-out-of-the-box results, and a resource footprint appropriate for a feature that is not the platform's primary data store. **OpenSearch flagged as the future upgrade path** if/when analytics-grade full-text search at very large log/document scale becomes necessary — chosen over Elasticsearch specifically due to Elastic's 2021 relicensing away from the fully open Apache 2.0 license (same category of licensing-risk reasoning as the Redis→Valkey decision in §3.6); OpenSearch (the Apache-2.0-licensed, AWS/Linux-Foundation-adjacent fork) is the license-safe equivalent. This matches, without alteration, the Final Recommendation already made in TSR §3.14.

## 22. ADR Reference

[`adr/ADR-TSR-014-search-engine.md`](../adr/ADR-TSR-014-search-engine.md)

## 23. Migration Strategy

Search Engine is not a named row in `migration/migration-and-upgrade-strategy.md`'s current trigger table, but follows the same principle: the trigger condition for Meilisearch→OpenSearch is analytics-grade full-text search at very large log/document scale becoming a genuine requirement (not a calendar date), measured against real Dashboard/CRM search usage data rather than pre-guessed at TSR-writing time. Migration approach would mirror the pattern used elsewhere in this TSR: stand up OpenSearch alongside Meilisearch, dual-index new documents during a soak period, validate relevance/latency parity, cut over query traffic incrementally, decommission Meilisearch only after a safety margin — since the Dashboard/CRM search index is a derived, rebuildable view over Postgres (not a system of record), a full reindex from source is always available as a simpler alternative to dual-write/shadow-read if preferred at migration time.

## 24. Future Consideration

- Track Elastic's licensing posture over time; if Elasticsearch were to revert to a fully OSI-approved license, its technical maturity would justify re-scoring it against OpenSearch, though this TSR does not assume that will happen.
- Monitor real Dashboard/CRM search query volume and document count against Meilisearch's comfortable operating envelope, using actual Year-1 data as the basis for triggering (or not triggering) the OpenSearch upgrade path, per the Migration & Upgrade Strategy's stated principle of trigger-condition-driven, not calendar-driven, migration.
- Revisit whether Analytics Warehouse (Architecture §22) and Search Engine should ever converge if a future product requirement blurs the current clean separation between "CRM lookup" and "analytics-grade search" — not anticipated today, but named here so the boundary is a deliberate, documented one rather than an assumed permanent wall.
