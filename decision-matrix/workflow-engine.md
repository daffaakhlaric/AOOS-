# Decision Matrix — Workflow Engine

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.9
Full record: [`tech-stack/workflow-engine.md`](../tech-stack/workflow-engine.md) | ADR: [`adr/ADR-TSR-009-workflow-engine.md`](../adr/ADR-TSR-009-workflow-engine.md)

## How to read this matrix

Every dimension is scored **1 (worst) to 5 (best)**, with **Vendor Lock-in Risk** scored so that 5 = lowest risk, and **Estimated Cost** scored so that 5 = lowest relative cost — higher is always better across every row, consistent with every other TSR matrix. The **Internal (build from scratch)** column is scored conservatively on any dimension where quality is fundamentally unproven by definition (Performance, Scalability, Reliability, Community Maturity) — this is not a penalty applied out of bias against building in-house, it is the direct, honest consequence of "we have not built or battle-tested this yet," which is exactly why Constitution §1.2 ("don't reinvent solved problems") weighs against it. This matrix should be read alongside `tech-stack/workflow-engine.md` §20, because the master TSR's Final Recommendation explicitly preserves Inngest/Trigger.dev as a legitimate MVP-stage alternative rather than treating the numeric winner as the only acceptable starting point.

## Matrix

| Dimension            | Weight | Temporal | Inngest  | Trigger.dev | Internal Engine |
| -------------------- | ------ | -------- | -------- | ----------- | --------------- |
| Performance          | 8%     | 4        | 4        | 4           | 2               |
| Scalability          | 10%    | 5        | 4        | 4           | 2               |
| Reliability          | 18%    | 5        | 4        | 4           | 1               |
| Security             | 8%     | 4        | 4        | 4           | 3               |
| Maintainability      | 10%    | 3        | 5        | 5           | 1               |
| Developer Experience | 8%     | 3        | 5        | 5           | 2               |
| Ecosystem            | 8%     | 4        | 3        | 3           | 1               |
| Community Maturity   | 6%     | 4        | 3        | 3           | 1               |
| Licensing            | 6%     | 5        | 4        | 4           | 5               |
| Cloud Compatibility  | 6%     | 5        | 4        | 4           | 5               |
| Vendor Lock-in Risk  | 6%     | 4        | 3        | 3           | 5               |
| Estimated Cost       | 6%     | 3        | 4        | 4           | 2               |
| **Weighted Total**   | 100%   | **4.14** | **3.98** | **3.98**    | **2.16**        |

## Weight justification

- **Reliability (18%, highest weight by a wide margin)** — Workflow durability is explicitly core-domain-critical per DDD §2 Domain Vision ("nurturing sequences must never silently die"), the single highest-stakes property this category is chosen for. This weight is what makes Temporal the numeric as well as qualitative winner despite losing on Maintainability and Developer Experience.
- **Maintainability and Scalability (10% each)** — reflect the real, acknowledged operational-cost trade-off (Temporal's higher ops floor vs. Inngest/Trigger.dev's managed convenience) and the eventual thousands-of-tenant scale target.
- **Performance, Security, Developer Experience, Ecosystem (8% each)** — solid contributors but secondary to durability and long-term operability for a core-domain system.
- **Community Maturity, Licensing, Cloud Compatibility, Vendor Lock-in, Estimated Cost (6% each)** — real but lower-leverage factors for this specific decision; note Licensing and Vendor Lock-in favor self-hosted options (Temporal, Internal) over the managed-control-plane commercial dependency inherent to Inngest/Trigger.dev's fast-path model.
- **Internal Engine's low weighted total (2.16) is intentional and evidentiary**, not punitive — it quantifies why Constitution §1.2 correctly rules it out: even generous scores on Licensing/Cloud Compatibility/Lock-in cannot offset unproven Reliability on a core-domain-critical property.

**Result:** Temporal (4.14) wins the weighted total, consistent with the Final Recommendation, while Inngest and Trigger.dev's near-tie (3.98 each) numerically supports the master TSR's explicit permission to start there for MVP velocity — the gap to Temporal is real but not so wide as to make that alternative path illegitimate, which is precisely the nuance `tech-stack/workflow-engine.md` §21 preserves.
