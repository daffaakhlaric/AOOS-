# Decision Matrix — Object Storage

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.13 · Full detail: [`tech-stack/object-storage.md`](../tech-stack/object-storage.md) · ADR: [`adr/ADR-TSR-013-object-storage.md`](../adr/ADR-TSR-013-object-storage.md)

## How to read this matrix

- Scale is **1 (worst) to 5 (best)**. **Vendor Lock-in Risk** and **Estimated Cost** are scored so that **5 = lowest risk / lowest cost** — read a high number as favorable in both columns.
- All three candidates speak the S3 API. This is precisely why the Vendor Lock-in Risk scores are all mid-to-high (3–5) rather than spread wide — protocol portability caps how much lock-in risk any S3-API-compatible provider can carry, which is the central argument of `tech-stack/object-storage.md` §16.
- This is a three-way default/fallback/self-hosted split, not a single winner: R2 is the production default, S3 is the named fallback for AWS-standardized or compliance-driven Enterprise tenants, and MinIO is scoped to self-hosted/dev/CI/data-residency cases. All three remain active recommendations simultaneously, unlike categories where the non-selected candidates are simply rejected.

## Scoring Matrix

| Dimension                             | Weight   | MinIO    | Amazon S3 | Cloudflare R2 |
| ------------------------------------- | -------- | -------- | --------- | ------------- |
| Performance                           | 8%       | 3        | 5         | 4             |
| Scalability                           | 12%      | 3        | 5         | 5             |
| Reliability                           | 12%      | 3        | 5         | 4             |
| Security                              | 8%       | 4        | 5         | 4             |
| Maintainability                       | 8%       | 2        | 5         | 5             |
| Developer Experience                  | 8%       | 4        | 5         | 4             |
| Ecosystem                             | 8%       | 3        | 5         | 4             |
| Community Maturity                    | 6%       | 4        | 5         | 3             |
| Licensing                             | 8%       | 4        | 5         | 5             |
| Cloud Compatibility                   | 6%       | 5        | 4         | 5             |
| Vendor Lock-in Risk (5 = lowest risk) | 10%      | 5        | 3         | 4             |
| Estimated Cost (5 = lowest cost)      | 6%       | 3        | 2         | 5             |
| **Weighted Total**                    | **100%** | **3.54** | **4.56**  | **4.34**      |

**Weight justification:** Scalability and Reliability weighted highest (12% each) for the same platform-wide reason applied throughout this TSR — durability/availability of backups and Knowledge documents is business-critical (Constitution §1.9, no silent failure). Vendor Lock-in Risk is weighted at 10%, above Ecosystem and Community Maturity, specifically because object storage is one of the harder layers to migrate under time pressure if it were ever proprietary — the weight reflects that stakes, even though the actual scores are compressed together by S3-API portability. Estimated Cost is weighted at 6%, but is the single dimension with the widest score spread (2 for S3 vs. 5 for R2) — it is this dimension, not the weighted total, that is the deciding factor for R2 over S3 as default (see below).

**Reading the weighted total honestly:** Amazon S3's 4.56 is the highest weighted total of the three, ahead of R2's 4.34 — S3 is, on this matrix, the strongest generalist choice, unsurprising for the most mature managed object storage product in the industry. R2 is nonetheless the Final Recommendation for the **default production tier** specifically because of the Estimated Cost dimension's real-world magnitude: R2's zero-egress-fee model produces a materially different cost outcome at AOS's actual read-heavy access pattern and thousands-of-tenant scale (`cost-analysis/cost-model-100-1000-10000-dealers.md` §8) than the single cost-column score suggests in isolation — the dollar-figure gap at 10,000-dealer scale is large enough to outweigh S3's marginally higher generalist score. This is disclosed explicitly rather than adjusting the weighting to force a numeric win, consistent with this TSR's practice of not fabricating scores to match a predetermined outcome.
