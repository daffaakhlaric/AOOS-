# Decision Matrix — Cache

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.6
Full record: [`tech-stack/cache.md`](../tech-stack/cache.md) | ADR: [`adr/ADR-TSR-006-cache.md`](../adr/ADR-TSR-006-cache.md)

## How to read this matrix

Every dimension is scored **1 (worst) to 5 (best)** for the candidate on that dimension, with two dimensions where "best" needed an explicit direction called out because a naive reading could invert it:

- **Vendor Lock-in Risk** — scored so that **5 = lowest risk / most switchable**, 1 = highest risk. A high score here is good, exactly like every other row.
- **Estimated Cost** — scored so that **5 = lowest relative infrastructure cost**, 1 = most expensive. A high score here means cheaper, which is good.

This means every row in the table can be read the same way: **higher is always better**, regardless of dimension. No dimension is inverted relative to the others. The matrix is a decision-support artifact, not the sole basis for the Final Recommendation — licensing was treated as a hard filter (see `tech-stack/cache.md` §14) that overrides a purely additive score, consistent with the master TSR's guiding philosophy #2 (open, non-restrictively-licensed technology preferred).

## Matrix

| Dimension            | Weight | Redis (post-7.4) | Valkey   | DragonflyDB |
| -------------------- | ------ | ---------------- | -------- | ----------- |
| Performance          | 10%    | 4                | 4        | 5           |
| Scalability          | 8%     | 4                | 4        | 4           |
| Reliability          | 10%    | 5                | 4        | 3           |
| Security             | 8%     | 4                | 4        | 4           |
| Maintainability      | 8%     | 4                | 4        | 3           |
| Developer Experience | 6%     | 5                | 5        | 4           |
| Ecosystem            | 8%     | 5                | 4        | 3           |
| Community Maturity   | 6%     | 5                | 3        | 2           |
| Licensing            | 16%    | 1                | 5        | 2           |
| Cloud Compatibility  | 8%     | 5                | 5        | 4           |
| Vendor Lock-in Risk  | 8%     | 2                | 5        | 3           |
| Estimated Cost       | 4%     | 4                | 5        | 4           |
| **Weighted Total**   | 100%   | **3.68**         | **4.24** | **3.42**    |

## Weight justification

- **Licensing (16%, highest weight)** — for a commercial multi-tenant SaaS that intends to potentially offer managed/hosted tiers (master TSR §1 philosophy #2), the license terms of the platform's most heavily-used shared-infrastructure component are a direct legal/business risk, not a soft preference. This is why Licensing outweighs even Performance for this specific category, despite Performance mattering more in most other TSR categories.
- **Reliability (10%) and Performance (10%)** — cache correctness and latency sit directly on the Agent invocation hot path (Working Memory reads) and the rate-limiting hot path (API Gateway), so both are weighted above average.
- **Vendor Lock-in Risk and Ecosystem (8% each)** — reflect the master TSR's guiding philosophy #2 (avoid vendor-pricing exposure that scales worse than AOS's own cost model) and the practical need for mature managed-cloud support at scale.
- **Community Maturity and Developer Experience (6% each)** — lower weight because, per `tech-stack/cache.md` §11, DX is effectively identical across all three Redis-protocol-compatible candidates, and community maturity, while relevant to long-term risk, is a lagging indicator rather than a current operational concern for a protocol-compatible fork.
- **Estimated Cost (4%, lowest weight)** — cache is a comparatively small line item in the overall cost model (§17 of the full record: $150–$12,000/mo across all three scale tiers, versus AI/LLM inference's $3,000–$480,000/mo), so cost differentiation among these three specific candidates is real but not decision-driving on its own.

**Result:** Valkey wins the weighted total (4.24) primarily on the strength of its Licensing score, and remains competitive (not last) on every other dimension — consistent with the Final Recommendation in `tech-stack/cache.md` §21.
