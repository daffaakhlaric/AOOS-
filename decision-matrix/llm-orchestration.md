# Decision Matrix — LLM Orchestration

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.11 · Full detail: [`tech-stack/llm-orchestration.md`](../tech-stack/llm-orchestration.md) · ADR: [`adr/ADR-TSR-011-llm-orchestration.md`](../adr/ADR-TSR-011-llm-orchestration.md)

## How to read this matrix

- Scale is **1 (worst) to 5 (best)** for every dimension, with no exceptions — including **Vendor Lock-in Risk** and **Estimated Cost**, where a **5 means lowest risk / lowest cost**, not "most" of either. Do not read those two columns as "bigger number = more lock-in / more expensive."
- This category's matrix looks structurally different from most others in this TSR: it compares five _frameworks_ against a _build-it-yourself_ option, not five peer products solving the same integration problem the same way. The framework candidates score well on short-term/adoption dimensions (Ecosystem, Community Maturity, initial Developer Experience, initial Cost) precisely because they are pre-built; Custom Runtime scores well on the dimensions that determine long-run fit against AOS's already-fixed Contract abstraction (Maintainability, Security, Vendor Lock-in Risk).
- Scores are qualitative judgments grounded in each technology's publicly known design and AOS's own Contract Specification (doc 003.5), not from AOS-run benchmarks — no orchestration implementation exists yet.
- **Estimated Cost** in this matrix means engineering build/maintain effort, not metered runtime infrastructure spend — LLM Orchestration has no independent line item in `cost-analysis/cost-model-100-1000-10000-dealers.md` (it is not a hosted service billed per-use).
- The weighted total is a decision-support aid, not the sole basis for the Final Recommendation — the Final Recommendation in `tech-stack/llm-orchestration.md` §21 is also governed by the hard structural filter in TSR §1 point 3 (Contract-First compatibility), which a purely numeric score cannot fully capture. Custom Runtime wins even where its raw weighted total is close to a framework's, because the disqualifying factor (abstraction conflict) is categorical, not gradable.

## Scoring Matrix

| Dimension                                         | Weight   | LangGraph | Mastra   | CrewAI   | AutoGen  | Semantic Kernel | Custom Runtime |
| ------------------------------------------------- | -------- | --------- | -------- | -------- | -------- | --------------- | -------------- |
| Performance                                       | 8%       | 4         | 4        | 3        | 3        | 3               | 4              |
| Scalability                                       | 12%      | 3         | 3        | 2        | 3        | 3               | 4              |
| Reliability                                       | 12%      | 3         | 3        | 2        | 3        | 3               | 3              |
| Security                                          | 8%       | 3         | 3        | 3        | 3        | 3               | 5              |
| Maintainability                                   | 8%       | 2         | 2        | 2        | 2        | 2               | 4              |
| Developer Experience                              | 8%       | 4         | 4        | 3        | 3        | 3               | 2              |
| Ecosystem                                         | 8%       | 5         | 3        | 3        | 3        | 4               | 1              |
| Community Maturity                                | 6%       | 5         | 2        | 3        | 4        | 4               | 1              |
| Licensing                                         | 8%       | 5         | 5        | 5        | 5        | 5               | 5              |
| Cloud Compatibility                               | 6%       | 4         | 4        | 4        | 4        | 4               | 5              |
| Vendor Lock-in Risk (5 = lowest risk)             | 10%      | 2         | 3        | 3        | 3        | 3               | 5              |
| Estimated Cost (5 = lowest build/maintain effort) | 6%       | 4         | 4        | 4        | 4        | 4               | 2              |
| **Weighted Total**                                | **100%** | **3.54**  | **3.30** | **2.96** | **3.26** | **3.34**        | **3.50**       |

**Weight justification:** Scalability and Reliability are weighted highest (12% each) because AOS's differentiator is multi-tenant autonomous operation at thousands-of-dealer scale (Constitution §33), not any single orchestration call's peak throughput. Vendor Lock-in Risk is weighted above the middle of the pack (10%) because TSR §1 names lock-in avoidance as a guiding cross-category philosophy, and this category — the platform's central execution abstraction — is exactly where lock-in would be most expensive to unwind later. Ecosystem and Community Maturity are weighted lower (8% and 6%) deliberately: they measure short-term adoption convenience, which this category's Final Recommendation explicitly treats as a real but secondary cost, not a decisive one. Estimated Cost is weighted lowest (6%) because, unlike every other category in this TSR, this dimension measures one-time engineering effort rather than ongoing metered infrastructure spend that compounds with tenant scale.

**Reading the weighted total honestly:** LangGraph's 3.54 narrowly edges out Custom Runtime's 3.50 — a margin so small it should not be read as a mandate for either side on numbers alone. This is deliberately reported as-is, not adjusted to flatter the outcome: it demonstrates why this category's Final Recommendation is **not** decided by the weighted total. The decision is instead governed by the categorical, non-gradable disqualifier described in `tech-stack/llm-orchestration.md` §16/§21 — every framework candidate's native Agent/Tool/Memory abstraction structurally conflicts with the Agent/Planner/Reasoner/Reflection/Memory/Tool Contracts already specified in doc 003.5, a "hard filter" per TSR §1 point 3 that overrides a close numeric score. Custom Runtime is the Final Recommendation despite, not because of, having the marginally lower weighted total among the top two.
