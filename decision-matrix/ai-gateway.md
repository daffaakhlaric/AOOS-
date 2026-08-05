# Decision Matrix — AI Gateway

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.10
Full record: [`tech-stack/ai-gateway.md`](../tech-stack/ai-gateway.md) | ADR: [`adr/ADR-TSR-010-ai-gateway.md`](../adr/ADR-TSR-010-ai-gateway.md)

## How to read this matrix

Every dimension is scored **1 (worst) to 5 (best)**, with **Vendor Lock-in Risk** scored so that 5 = lowest risk, and **Estimated Cost** scored so that 5 = lowest relative cost — higher is always better across every row. **OpenRouter's Licensing cell is marked N/A** in the full record because it is consumed purely as a hosted commercial API, not self-hosted open-source software; for the purpose of this matrix's weighted total it is scored as a neutral 3, since the category's actual differentiator for OpenRouter is captured more accurately under Vendor Lock-in Risk and Estimated Cost, not Licensing. The **Custom Gateway** column, like the equivalent column in the Workflow Engine matrix, is scored conservatively wherever quality is unproven by definition (Performance, Reliability, Scalability) — a direct, honest consequence of it not yet existing, not a bias against building in-house.

## Matrix

| Dimension            | Weight | LiteLLM (self-hosted) | OpenRouter | Custom Gateway |
| -------------------- | ------ | --------------------- | ---------- | -------------- |
| Performance          | 8%     | 4                     | 4          | 3              |
| Scalability          | 8%     | 4                     | 4          | 3              |
| Reliability          | 12%    | 4                     | 3          | 2              |
| Security             | 12%    | 4                     | 3          | 4              |
| Maintainability      | 8%     | 4                     | 5          | 1              |
| Developer Experience | 6%     | 4                     | 5          | 2              |
| Ecosystem            | 6%     | 5                     | 4          | 1              |
| Community Maturity   | 4%     | 4                     | 3          | 1              |
| Licensing            | 6%     | 5                     | 3          | 5              |
| Cloud Compatibility  | 6%     | 5                     | 5          | 5              |
| Vendor Lock-in Risk  | 14%    | 4                     | 1          | 5              |
| Estimated Cost       | 10%    | 4                     | 2          | 3              |
| **Weighted Total**   | 100%   | **4.14**              | **3.29**   | **2.90**       |

## Weight justification

- **Vendor Lock-in Risk (14%, highest weight)** — the AI Gateway sits directly in the platform's single highest-frequency, most cost-sensitive call path (every LLM inference call across every Agent category), making lock-in risk here more consequential than in almost any other TSR category; this is the direct quantification of the master TSR §1 philosophy #2 warning and the specific reason OpenRouter scores lowest on any single dimension in this table (a 1).
- **Reliability and Security (12% each)** — an AI Gateway outage or data-handling failure has platform-wide blast radius (Risk Register RISK-009) and directly touches tenant-sensitive prompt/response content subject to Guardrail Engine data-handling obligations, justifying above-average weight on both.
- **Estimated Cost (10%)** — weighted meaningfully above its counterpart in other TSR categories because AI/LLM inference is already the platform's dominant cost line by a wide margin (40-65% of total spend, master TSR §5); a per-token margin compounding on top of that line has outsized absolute-dollar impact versus the same proportional margin on a smaller cost category.
- **Performance, Scalability, Maintainability (8% each)** — solid, real factors but secondary to the lock-in/reliability/cost calculus specific to this category's structural position in the platform.
- **Developer Experience, Ecosystem, Licensing, Cloud Compatibility (6% each), Community Maturity (4%, lowest weight)** — genuine but lower-leverage factors; note OpenRouter's strong Maintainability/DX scores (5 each, a real and acknowledged advantage of a fully managed service) are directly outweighed by its Vendor Lock-in Risk and Estimated Cost scores once the weighting is applied.

**Result:** LiteLLM (4.14) wins decisively over both OpenRouter (3.29) and a Custom Gateway (2.90), consistent with the Final Recommendation in `tech-stack/ai-gateway.md` §21 — the weighting deliberately reflects that this category's decision hinges on lock-in and cost-at-scale more than on any single technical performance dimension.
