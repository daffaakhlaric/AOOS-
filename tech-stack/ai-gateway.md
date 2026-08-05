# Tech Stack Record — AI Gateway

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.10
ADR: [`adr/ADR-TSR-010-ai-gateway.md`](../adr/ADR-TSR-010-ai-gateway.md)
Decision Matrix: [`decision-matrix/ai-gateway.md`](../decision-matrix/ai-gateway.md)

---

## 1. Objective

Choose the layer translating the Model Router Contract's (doc 003.5 §14, Architecture doc 002 §19 / ADR-008) provider abstraction into concrete LLM provider API calls. This is a protocol-translation and low-level execution layer sitting underneath AOS's own Model Router — it must not become the platform's routing _policy_ owner, only its provider-protocol execution mechanism.

## 2. Requirements

- Multi-provider support spanning every tier named in the master TSR §4 Routing Table (Claude, GPT, Gemini, plus fast/cheap-tier and long-context-tier equivalents).
- Fallback chain execution matching the Model Contract's `fallback` field semantics (outage-driven fallback, distinct from confidence-driven tier escalation per master TSR §4.2).
- Cost metering per call, feeding Agent Contract `cost_limit`/`token_limit` enforcement (Architecture ADR-018: cost ceilings enforced outside the Agent).
- Self-hostable — a hard requirement, not a preference: the gateway must not become an additional third-party vendor sitting directly in the platform's highest-frequency, cost-sensitive call path, adding its own margin on top of every token.
- Tenant BYO-key handling (tenants supplying their own provider API keys, a documented Enterprise capability per Architecture's Model Router design).

## 3. Candidate Technologies

| Candidate             | Summary                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LiteLLM**           | Open-source proxy/SDK that normalizes 100+ LLM providers behind an OpenAI-compatible API surface; runs self-hosted as a proxy server or embedded as a library. |
| **OpenRouter**        | Hosted, third-party multi-provider LLM routing service — a managed intermediary sitting between the caller and the underlying model providers.                 |
| **Custom AI Gateway** | A fully in-house-built protocol-translation layer covering every provider AOS needs to route across.                                                           |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best); **Vendor Lock-in Risk** — 5 = lowest risk; **Estimated Cost** — 5 = lowest relative cost.

| Dimension            | LiteLLM (self-hosted)                      | OpenRouter                                                          | Custom Gateway                                             |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Performance          | 4                                          | 4                                                                   | Unknown (3, unproven, but full control)                    |
| Scalability          | 4                                          | 4 (bounded by third-party service)                                  | Unknown (3)                                                |
| Reliability          | 4                                          | 3 (adds a third-party dependency to every call)                     | Unknown (2, unproven)                                      |
| Security             | 4                                          | 3 (provider keys/traffic pass through a third party)                | 4 (full control, but unaudited)                            |
| Maintainability      | 4                                          | 5 (nothing to operate)                                              | 1                                                          |
| Developer Experience | 4                                          | 5                                                                   | 2                                                          |
| Ecosystem            | 5 (widest provider coverage of any option) | 4                                                                   | 1                                                          |
| Community Maturity   | 4                                          | 3                                                                   | 1                                                          |
| Licensing            | 5 (MIT)                                    | N/A (hosted commercial service, not licensed software)              | 5 (fully owned)                                            |
| Cloud Compatibility  | 5                                          | 5 (API-based, cloud-agnostic)                                       | 5                                                          |
| Vendor Lock-in Risk  | 4                                          | 1 (sits directly in the highest-frequency cost-sensitive call path) | 5                                                          |
| Estimated Cost       | 4 (infra cost only, no per-token margin)   | 2 (adds its own margin on top of every token, at platform scale)    | 3 (no per-token margin, but very high build/maintain cost) |

## 5. Benchmark

No dedicated `benchmarks/ai-gateway-benchmarks.md` file exists in this deliverable set; the closest available reference is [`benchmarks/llm-model-benchmarks.md`](../benchmarks/llm-model-benchmarks.md), which documents the _model-tier_ landscape (§4 Routing Table) that the AI Gateway must be able to route across, not the gateway technology itself. Per that file's stated methodology, positioning is relative and directional, based on published provider documentation, not AOS-measured. LiteLLM's provider-breadth claim (100+ providers) and OpenRouter's per-token margin structure are stated here as directional, publicly-documented product characteristics as of this writing, not precise measured figures.

## 6. Performance

LiteLLM (self-hosted, deployed within AOS's own network/Kubernetes cluster per §3.20) adds minimal latency overhead versus a direct provider call — a thin protocol-translation hop within the platform's own infrastructure. OpenRouter, being an external hosted intermediary, adds an additional network hop and a third party's own request-handling latency on top of every call, which is directly counter to the Conversational AI category's strict latency requirement (master TSR §4.1 Routing Table).

## 7. Scalability

LiteLLM scales horizontally as a stateless proxy behind the platform's own load balancer/API Gateway (Kong, §3.15), scaling independently with AOS's own traffic. OpenRouter's scalability is bounded by a third party's own infrastructure and rate limits, outside AOS's control — a structural ceiling the platform does not own or observe directly.

## 8. Reliability

Self-hosted LiteLLM, deployed multi-replica, keeps the platform in control of its own uptime for the AI Gateway hop (Risk Register RISK-009 mitigation: "Deploy LiteLLM proxy multi-replica behind the API Gateway/internal load balancer"). OpenRouter introduces an additional external dependency and failure domain on every single LLM call across the entire platform — a materially larger blast radius for a third-party outage than a self-hosted, platform-controlled proxy.

## 9. Security

Self-hosted LiteLLM keeps provider API keys and prompt/response traffic entirely within AOS's own network boundary and Vault-managed secret custody (§3.22), consistent with Constitution §20 least-privilege mandate. OpenRouter requires provider traffic (potentially including tenant-sensitive prompt content, per the Guardrail Engine's data-handling obligations) to pass through a third party's infrastructure, a materially different security/data-residency posture that is harder to reconcile with Enterprise-tier data-residency commitments.

## 10. Maintainability

OpenRouter, as a fully managed hosted service, requires zero operational maintenance from AOS — this is a real, honestly-acknowledged advantage, not dismissed. Self-hosted LiteLLM requires the platform to operate, patch, and scale one more service. A Custom Gateway would require maintaining protocol-translation logic against every provider's evolving API surface indefinitely — the single largest ongoing maintenance burden of any option, since provider APIs change independently and frequently.

## 11. Developer Experience

LiteLLM exposes an OpenAI-compatible API surface across all supported providers, meaning AOS's Model Router Contract implementation only needs to integrate against one consistent request/response shape rather than every individual provider's SDK — a direct, material DX win regardless of self-hosted-vs-managed deployment mode. OpenRouter offers the same DX benefit but as a hosted service requiring zero setup. A Custom Gateway would require building and maintaining this abstraction layer from scratch.

## 12. Ecosystem

LiteLLM has the widest documented provider-coverage ecosystem of any evaluated option (commonly cited as 100+ providers, including all providers named in the master TSR §4 Routing Table — Claude, GPT, Gemini, Whisper-class, and more), plus a large, actively maintained open-source community. OpenRouter's provider coverage is also broad but is a curated, commercially-controlled catalog rather than an open extensible integration a self-hosting team can add to directly. A Custom Gateway starts with zero ecosystem.

## 13. Community Maturity

LiteLLM is a mature, widely-adopted open-source project with an active contributor base specifically because many teams share AOS's exact self-hosting motivation (avoiding a third-party inference-routing margin). OpenRouter has a smaller open community footprint since it is primarily a commercial product, not an open-source project to contribute to. A Custom Gateway has no external community.

## 14. Licensing

**LiteLLM: MIT license** (the open-source proxy/SDK; note that LiteLLM's vendor also offers a separately-licensed commercial Enterprise tier with additional features, which AOS is not required to adopt — the core self-hosted proxy used for this decision remains MIT). Fully permissive, aligned with the master TSR §1 philosophy #2. **OpenRouter** is not open-source software being licensed for self-hosting at all — it is consumed purely as a hosted commercial API service, so "licensing" in the open-source sense does not apply; the relevant commercial term instead is OpenRouter's own usage/margin pricing, addressed under Estimated Cost (§17). **Custom Gateway**: fully owned, no license constraint, at the cost of the full build/maintain burden.

## 15. Cloud Compatibility

LiteLLM deploys self-hosted on Kubernetes (§3.20) alongside every other Core Runtime service, or can be run as an embedded library within a Node.js/Python service. OpenRouter is consumed via a plain HTTPS API call from anywhere, technically cloud-agnostic but architecturally external to AOS's own deployment topology. A Custom Gateway is fully cloud-compatible by construction, being AOS's own code.

## 16. Vendor Lock-in

This is a decisive dimension against OpenRouter: it sits directly in the platform's single highest-frequency, most cost-sensitive call path (every LLM inference call across every Agent category), making it a structurally deep, ongoing vendor dependency exactly where the master TSR's guiding philosophy #2 (avoid vendor pricing that scales worse than AOS's own cost model) is most consequential. LiteLLM, self-hosted and open-source, carries minimal lock-in — the Model Router Contract's own abstraction (doc 003.5 §14) is the platform's actual routing-policy owner, with LiteLLM as a swappable protocol-translation implementation detail underneath it.

## 17. Estimated Cost

Per [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md) §2, AI/LLM inference is the platform's dominant cost line at every scale: **$3,000–$7,000/mo at 100 dealers, $25,000–$55,000/mo at 1,000 dealers, $220,000–$480,000/mo at 10,000 dealers** (roughly 40-65% of total infrastructure spend per master TSR §5's key takeaway). Self-hosted LiteLLM adds only its own thin proxy infrastructure cost (folded into the general Compute Infrastructure line, §3 of the cost model) with **no additional per-token margin**. OpenRouter, by contrast, adds its own commercial margin on top of every single token processed through it — at the AI-inference-dominated cost structure this platform already has, even a modest per-token margin compounds into a very large absolute-dollar cost at the 10,000-dealer tier, which is exactly the scenario the master TSR's trade-off note is warning against.

## 18. Pros

**LiteLLM (self-hosted):** no per-token third-party margin at platform scale; keeps provider traffic within AOS's own network/security boundary; OpenAI-compatible unified API surface across 100+ providers; MIT-licensed with an active open-source community; deployable natively within the existing Kubernetes/Vault infrastructure.

## 19. Cons

**LiteLLM (self-hosted):** adds one more service the platform must operate, patch, and scale itself (multi-replica deployment required to avoid becoming a single point of failure, per Risk Register RISK-009), versus a fully managed alternative requiring zero such investment.

## 20. Trade-offs

Self-hosting LiteLLM adds one more service to operate versus a hosted alternative (OpenRouter), accepted to avoid a permanent per-token margin from a third-party gateway at platform scale — a direct, quantifiable trade-off given that AI/LLM inference is already the platform's single largest cost line by a wide margin (§17 above), making even a small proportional margin on top of it a large absolute cost.

## 21. Final Recommendation

Matching the master TSR §3.10 verbatim: **LiteLLM** (self-hosted proxy mode) — open-source, supports the breadth of providers the Model Contract needs to route across, handles low-level protocol translation so AOS's own Model Router Contract implementation only needs to own routing _policy_ (cost ceilings, fallback chain order, tenant BYO-key handling) rather than every provider's request/response shape. **OpenRouter is not recommended as the primary path** — it is a third-party hosted intermediary that adds its own margin on top of every token and, more importantly, becomes an additional vendor dependency sitting directly in the platform's highest-frequency, cost-sensitive call path (violates the vendor-lock-in-avoidance principle in master TSR §1). It remains usable as an optional _fallback provider entry_ for exotic models not worth direct-integrating. **A fully Custom Gateway is not recommended** — LiteLLM already solves the protocol-translation problem well; building a custom equivalent would be reinventing a solved, actively-maintained open-source component (Constitution §1.2).

## 22. ADR Reference

[`adr/ADR-TSR-010-ai-gateway.md`](../adr/ADR-TSR-010-ai-gateway.md)

## 23. Migration Strategy

The master migration document ([`migration/migration-and-upgrade-strategy.md`](../migration/migration-and-upgrade-strategy.md) §2) does not name an AI Gateway-specific "default + escape hatch" migration row — LiteLLM is adopted as a durable choice, not a placeholder pending a pre-planned swap, reflecting that its self-hosted, protocol-translation role is architecturally stable regardless of which underlying LLM providers or model tiers change over time (the Model Router Contract's tier abstraction, master TSR §4.2, is precisely what insulates AOS from needing to migrate the gateway layer itself when providers change). The relevant operational discipline instead follows the general Upgrade Strategy in that document's §3: pin the LiteLLM version explicitly, stage upgrades through dev → staging → canary-tenant-subset → general availability, and treat critical security patches (e.g., a CVE in a provider-integration path) on the expedited track. If LiteLLM's own project health or licensing terms were ever to degrade materially, the practical migration path is to another self-hosted, OpenAI-compatible proxy implementation (the Model Router Contract's own abstraction means the rest of the platform is insulated from this swap, mirroring the reasoning already applied to Cache/Event Bus escape hatches), or in the narrower case of provider-outage handling, to lean further on the Model Contract's existing multi-provider fallback chain rather than the gateway software itself.

## 24. Future Consideration

Deploy LiteLLM multi-replica behind the API Gateway/internal load balancer from the first production environment, per Risk Register RISK-009, rather than deferring HA as a later hardening task (mirroring the same discipline already required for Keycloak, RISK-007). Revisit OpenRouter strictly as a narrow fallback-provider entry for exotic/low-volume models not worth direct-integrating via LiteLLM, consistent with the master TSR's stated exception, and monitor LiteLLM's own commercial Enterprise-tier feature set in case a future capability gap in the open-source core becomes a blocking requirement (the same "feature-gap-driven, not scale-driven" evaluation discipline already applied to the Kong OSS vs. Enterprise decision, §3.15).
