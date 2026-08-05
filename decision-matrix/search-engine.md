# Decision Matrix — Search Engine

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.14 · Full detail: [`tech-stack/search-engine.md`](../tech-stack/search-engine.md) · ADR: [`adr/ADR-TSR-014-search-engine.md`](../adr/ADR-TSR-014-search-engine.md)

## How to read this matrix

- Scale is **1 (worst) to 5 (best)**. **Vendor Lock-in Risk** and **Estimated Cost** are scored so that **5 = lowest risk / lowest cost**.
- The **Licensing** column is the one most load-bearing for this category's outcome and deserves explicit attention: Elasticsearch scores a 2 specifically because its Elastic License v2 / SSPL dual license is **not OSI-approved open source**, while OpenSearch (Apache-2.0) and Meilisearch (MIT) both score a 5 as unambiguous, fully permissive licenses. This is not a stylistic preference — it directly disqualifies Elasticsearch as a build target for AOS regardless of its technical merits on other dimensions (see `tech-stack/search-engine.md` §14).
- Elasticsearch and OpenSearch score near-identically on every technical dimension (Performance, Scalability, Ecosystem) because OpenSearch is a fork of Elasticsearch's own codebase at the 2021 licensing split — the two are compared here to make the licensing divergence, not a technical divergence, the visible deciding factor between them.

## Scoring Matrix

| Dimension                             | Weight   | Elasticsearch | OpenSearch | Meilisearch |
| ------------------------------------- | -------- | ------------- | ---------- | ----------- |
| Performance                           | 8%       | 5             | 5          | 4           |
| Scalability                           | 12%      | 5             | 5          | 3           |
| Reliability                           | 12%      | 5             | 4          | 4           |
| Security                              | 8%       | 4             | 4          | 3           |
| Maintainability                       | 8%       | 2             | 2          | 5           |
| Developer Experience                  | 8%       | 3             | 3          | 5           |
| Ecosystem                             | 8%       | 5             | 4          | 3           |
| Community Maturity                    | 6%       | 5             | 4          | 3           |
| Licensing                             | 8%       | 2             | 5          | 5           |
| Cloud Compatibility                   | 6%       | 5             | 5          | 5           |
| Vendor Lock-in Risk (5 = lowest risk) | 10%      | 3             | 5          | 5           |
| Estimated Cost (5 = lowest cost)      | 6%       | 2             | 2          | 5           |
| **Weighted Total**                    | **100%** | **3.90**      | **4.08**   | **4.12**    |

**Weight justification:** Scalability and Reliability are weighted highest (12% each), consistent across this TSR's data-store-adjacent categories, though notably this is the one category where that weighting favors the _rejected_ candidate (Elasticsearch) most — a deliberate illustration that this decision is not primarily a technical-capability contest. Licensing is weighted at 8%, on par with Security and Developer Experience, but its 2-vs-5 score spread makes it disproportionately decisive relative to its nominal weight — the same dynamic as the Redis→Valkey decision (TSR §3.6). Maintainability and Estimated Cost together (8% + 6%) capture the operational-burden gap between Meilisearch's single-binary model and Elasticsearch/OpenSearch's JVM-cluster model, which is the second deciding factor after licensing.

**Reading the weighted total honestly:** Meilisearch's 4.12 and OpenSearch's 4.08 are close enough to be read as a statistical tie; Elasticsearch's 3.90 trails both. The Final Recommendation follows this ordering directly for the default choice (Meilisearch) and treats OpenSearch, not Elasticsearch, as the correct upgrade path precisely because OpenSearch inherits nearly all of Elasticsearch's raw technical score (Performance, Scalability, Ecosystem) while clearing the licensing disqualifier that keeps Elasticsearch itself off the table as a build target.
