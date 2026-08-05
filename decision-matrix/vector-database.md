# Decision Matrix — Vector Database

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.12 · Full detail: [`tech-stack/vector-database.md`](../tech-stack/vector-database.md) · ADR: [`adr/ADR-TSR-012-vector-database.md`](../adr/ADR-TSR-012-vector-database.md)

## How to read this matrix

- Scale is **1 (worst) to 5 (best)**. **Vendor Lock-in Risk** and **Estimated Cost** are scored so that **5 = lowest risk / lowest cost** — a high number is always favorable, never a warning sign.
- This is a two-tier decision, not a single winner-take-all pick: pgvector is the default for the shared tier, Qdrant is the named escape hatch for tenants/aggregate load that outgrow it (see `migration/migration-and-upgrade-strategy.md` for the trigger condition). The matrix scores all four candidates as peers so the trade-off is visible, but the Final Recommendation activates two of them for two different operating conditions rather than picking one exclusively.
- Scores reflect pgvector's structural advantage of running inside the already-selected primary OLTP database (§3.4 PostgreSQL) rather than as independent infrastructure — this is why pgvector scores lower on raw Performance/Scalability but higher on Maintainability/Security/Cost than the purpose-built alternatives.

## Scoring Matrix

| Dimension                             | Weight   | pgvector | Qdrant   | Weaviate | Milvus   |
| ------------------------------------- | -------- | -------- | -------- | -------- | -------- |
| Performance                           | 8%       | 3        | 5        | 4        | 5        |
| Scalability                           | 12%      | 2        | 4        | 4        | 5        |
| Reliability                           | 12%      | 4        | 4        | 4        | 3        |
| Security                              | 8%       | 4        | 3        | 3        | 3        |
| Maintainability                       | 8%       | 5        | 4        | 3        | 2        |
| Developer Experience                  | 8%       | 4        | 4        | 3        | 3        |
| Ecosystem                             | 8%       | 3        | 4        | 4        | 4        |
| Community Maturity                    | 6%       | 4        | 4        | 4        | 4        |
| Licensing                             | 8%       | 5        | 5        | 4        | 5        |
| Cloud Compatibility                   | 6%       | 5        | 5        | 5        | 4        |
| Vendor Lock-in Risk (5 = lowest risk) | 10%      | 5        | 4        | 4        | 4        |
| Estimated Cost (5 = lowest cost)      | 6%       | 5        | 3        | 3        | 2        |
| **Weighted Total**                    | **100%** | **3.98** | **4.08** | **3.76** | **3.72** |

**Weight justification:** Scalability and Reliability weighted highest (12% each), matching the standard weighting applied across this TSR's data-store categories, because AOS's differentiator is sustained multi-tenant operation, not any single tenant's peak query throughput. Vendor Lock-in Risk (10%) is weighted above Ecosystem/Community Maturity (8%/6%) because every candidate here is self-hostable and open-source, making lock-in primarily a function of migration friction (addressed directly in `migration/migration-and-upgrade-strategy.md`) rather than licensing risk. Estimated Cost is weighted at 6% — lower than Scalability/Reliability but not negligible — because vector database spend is a real, if secondary, line in `cost-analysis/cost-model-100-1000-10000-dealers.md` §7 that grows materially once the Qdrant tier activates.

**Reading the weighted total honestly:** Qdrant's 4.08 edges out pgvector's 3.98 — on a pure peer-to-peer numeric comparison, Qdrant is the marginally stronger general-purpose vector database. This is expected and does not contradict the Final Recommendation: pgvector is recommended as the **default tier** specifically because it requires zero incremental infrastructure on top of the already-selected PostgreSQL database (§3.4) and inherits its native Row-Level Security model directly, an operational-simplicity and tenant-isolation argument the raw per-dimension score does not fully capture in a single number. Qdrant's higher score is exactly why it is the named escape hatch rather than being discarded — the two recommendations are complementary, not competing, positions on this same matrix.
