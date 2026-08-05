# Decision Matrix — Documentation

**Category:** §3.25 of [`../docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md)
**Full record:** [`../tech-stack/documentation.md`](../tech-stack/documentation.md)
**ADR:** [`../adr/ADR-TSR-025-documentation.md`](../adr/ADR-TSR-025-documentation.md)

## How to read this matrix

Every dimension is scored **1 (worst) – 5 (best)**. **Vendor Lock-in Risk** and **Estimated Cost** are inverted so "5" always means "best for AOS" (5 = lowest lock-in / cheapest). This category has a **dual Final Recommendation** (Docusaurus for the internal Engineering Handbook, Mintlify for external API/SDK docs), so — as with Testing — the matrix is split into **two sub-tables**, one per use case, each with its own weighting reflecting that use case's actual requirements. A single flattened three-way table would obscure the reason the recommendation splits: the two use cases genuinely weight the same dimensions differently.

## Sub-Matrix A — Internal Engineering Handbook

| Dimension                                | Weight   | Docusaurus | MkDocs   | Mintlify |
| ---------------------------------------- | -------- | ---------- | -------- | -------- |
| Performance                              | 4%       | 4          | 4        | 5        |
| Scalability (versioning)                 | 15%      | 5          | 4        | 4        |
| Reliability                              | 6%       | 4          | 4        | 4        |
| Security (self-hostable/gateable)        | 8%       | 4          | 4        | 3        |
| Maintainability (toolchain alignment)    | 15%      | 4          | 3        | 5        |
| Developer Experience                     | 8%       | 4          | 4        | 5        |
| Ecosystem                                | 8%       | 5          | 4        | 3        |
| Community Maturity                       | 5%       | 5          | 5        | 3        |
| Licensing                                | 8%       | 5          | 5        | 2        |
| Cloud Compatibility (self-host anywhere) | 8%       | 5          | 5        | 3        |
| Vendor Lock-in Risk                      | 12%      | 5          | 5        | 2        |
| Estimated Cost                           | 3%       | 5          | 5        | 3        |
| **Weighted Total**                       | **100%** | **4.56**   | **4.19** | **3.44** |

## Sub-Matrix B — External Developer/API/SDK Docs

| Dimension                                      | Weight   | Docusaurus | MkDocs   | Mintlify |
| ---------------------------------------------- | -------- | ---------- | -------- | -------- |
| Performance                                    | 5%       | 4          | 4        | 5        |
| Scalability                                    | 6%       | 4          | 3        | 4        |
| Reliability                                    | 6%       | 4          | 4        | 4        |
| Security                                       | 5%       | 4          | 4        | 4        |
| Maintainability                                | 8%       | 4          | 3        | 5        |
| Developer Experience (API-reference authoring) | 22%      | 3          | 3        | 5        |
| Ecosystem (OpenAPI/schema tooling)             | 15%      | 3          | 3        | 4        |
| Community Maturity                             | 4%       | 5          | 5        | 3        |
| Licensing                                      | 4%       | 5          | 5        | 2        |
| Cloud Compatibility                            | 5%       | 5          | 5        | 3        |
| Vendor Lock-in Risk                            | 8%       | 5          | 5        | 2        |
| Estimated Cost                                 | 12%      | 5          | 5        | 3        |
| **Weighted Total**                             | **100%** | **3.98**   | **3.75** | **4.14** |

## Weight Justification

- **Sub-Matrix A weights Scalability/versioning (15%), Maintainability/toolchain-alignment (15%), and Vendor Lock-in Risk (12%) highest** — the internal handbook's defining requirements are exactly these three: a living, amendable document set (Constitution §21.5) needing first-class versioning; a team that should not need a second toolchain (Python/MkDocs) alongside the existing TypeScript/React stack (§3.1/§3.3); and zero third-party dependency for governing documents. Mintlify scores lowest on all three, which is precisely why it is not recommended for this surface despite scoring well elsewhere.
- **Sub-Matrix B weights Developer Experience for API-reference authoring (22%) and Ecosystem/OpenAPI-schema tooling (15%) highest** — the external-docs job is specifically about rendering the Contract Specification's JSON Schemas (doc 003.5) as interactive, trustworthy API reference (Constitution §22.4's schema-sync requirement), a job Mintlify is purpose-built for and the other two are not; this is the inverse weighting priority from Sub-Matrix A, by design.
- **Estimated Cost is weighted low (3%) in Sub-Matrix A but higher (12%) in Sub-Matrix B** — self-hosting cost is negligible either way for the low-traffic internal handbook, but Mintlify's metered SaaS pricing is a genuine, non-negligible recurring cost specifically for the external-docs use case, which is why it is weighted more heavily there even though Mintlify still wins that sub-matrix overall.
- **Licensing and Vendor Lock-in Risk are weighted meaningfully in both sub-matrices** but matter more in Sub-Matrix A (12% vs. 8%) — governing documents warrant a stronger zero-lock-in bias than a bounded, lower-stakes external-docs surface where some lock-in is an acceptable, explicitly reasoned trade (per `tech-stack/documentation.md`'s Trade-offs section).

## Result

Docusaurus wins Sub-Matrix A decisively (4.56 vs. 4.19 vs. 3.44); Mintlify wins Sub-Matrix B (4.14 vs. 3.98 vs. 3.75) — a much narrower margin than Sub-Matrix A's, correctly reflecting that Docusaurus remains a credible, not disqualified, choice for external docs too (it is "not adopted" for that surface by preference for Mintlify's purpose-built DX, not because it is unusable there). MkDocs does not win either sub-matrix, consistent with the Final Recommendation's decision not to adopt it, though it remains a reasonable alternative to Docusaurus specifically for a team preferring Python-based tooling, as the master TSR notes.
