# ADR-TSR-014 — Search Engine: Meilisearch Default, OpenSearch Future Upgrade Path (Not Elasticsearch)

**Status:** Accepted

**Context:** Dashboard/CRM full-text search (lead/customer/inventory lookup, CRM record search) is a supporting product feature, not the platform's primary data store or its analytics engine — Analytics Warehouse (Architecture §22) already serves aggregation/analytics needs. The three natural candidates are Elasticsearch, OpenSearch, and Meilisearch. Elasticsearch, since its 2021 relicensing, ships under a dual Elastic License v2 / Server Side Public License (SSPL) model, neither of which is OSI-approved open source — the same category of licensing risk already named and rejected for Redis in TSR §3.6 (Redis→Valkey). OpenSearch is the Apache-2.0-licensed fork created specifically in response to that relicensing, sharing Elasticsearch's codebase lineage and near-identical technical capability without the licensing risk.

**Decision:** **Meilisearch** is the default search technology for tenant-facing product search — lower operational overhead (single-binary, minimal tuning) than either Elasticsearch or OpenSearch, appropriate for a supporting feature with a bounded, product-search-shaped requirement. **OpenSearch** is the named future upgrade path if/when analytics-grade full-text search at very large log/document scale becomes necessary, chosen explicitly over Elasticsearch on licensing grounds. **Elasticsearch is not recommended as a build target at any point in this platform's stack**, regardless of its technical merits, because its SSPL/Elastic License terms are a structural risk for a commercial multi-tenant SaaS that intends to remain freely self-hostable and potentially offer managed tiers.

**Consequences:**

- The default Dashboard/CRM search feature carries a materially lighter operational footprint (no JVM tuning, no shard/cluster management) than an Elasticsearch/OpenSearch-based default would.
- No native large-scale aggregation/analytics capability exists in the search layer itself — acceptable because Analytics Warehouse (Architecture §22) already owns that need, and conflating the two would be over-provisioning.
- A clear, pre-planned upgrade path (OpenSearch) exists if search requirements grow beyond Meilisearch's comfortable scope, without any Elasticsearch licensing exposure ever entering the stack, even transiently.
- Because the Dashboard/CRM search index is a derived, rebuildable view over the RLS-governed Postgres data (§3.4), the reliability/durability bar for the search layer itself is lower than for a system of record — a full reindex from source is always an available migration/recovery option.

**Alternatives Considered:**

- **Elasticsearch as the default or as the upgrade path** (rejected outright at any tier: SSPL/Elastic License is not OSI-approved open source; several of its security features are additionally gated to paid tiers where OpenSearch ships the equivalent fully open — a licensing-risk profile this TSR treats as disqualifying on the same basis as the Redis relicensing precedent, independent of Elasticsearch's genuine technical maturity).
- **OpenSearch as the default from day one** (rejected for the default tier: inherits Elasticsearch's heavy JVM/cluster operational profile, disproportionate to a supporting CRM-lookup feature at AOS's near-term scale; reserved instead as the named upgrade path for when that operational cost is actually justified by real analytics-grade search demand).
- **No dedicated search engine — full-text search via Postgres native capabilities alone** (rejected: Postgres full-text search is adequate for basic cases but lacks the typo-tolerance, instant-search relevance tuning, and dedicated indexing performance a tenant-facing CRM lookup feature benefits from; Meilisearch's marginal operational cost over "nothing additional" is judged worthwhile for the DX/UX gain).
