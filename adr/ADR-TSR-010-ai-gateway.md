# ADR-TSR-010 — LiteLLM (Self-Hosted) as the AI Gateway

**Status:** Accepted

**Context:** The Model Router Contract (doc 003.5 §14, Architecture doc 002 §19 / ADR-008) requires a layer that translates AOS's own provider-agnostic routing abstraction into concrete LLM provider API calls, across every provider/tier named in the master TSR §4 Routing Table (Claude, GPT, Gemini, Whisper-class, and others). This layer must support multi-provider fallback chain execution, per-call cost metering feeding Architecture ADR-018's outside-the-Agent cost-ceiling enforcement, and tenant BYO-key handling. Because this layer sits on every single LLM inference call across every Agent category — the platform's highest-frequency, most cost-sensitive call path, and already the dominant line in the platform's cost structure (40-65% of total spend per master TSR §5) — its deployment model (self-hosted vs. third-party-hosted) has outsized consequences for both cost and vendor dependency risk relative to most other infrastructure decisions in this TSR.

**Decision:** Adopt **LiteLLM**, deployed self-hosted in proxy mode within AOS's own Kubernetes infrastructure (§3.20), as the AI Gateway. OpenRouter is evaluated and not adopted as the primary path, remaining available only as an optional fallback-provider entry for exotic, low-volume models not worth direct-integrating. A fully Custom Gateway is evaluated and rejected.

All inference calls route: Agent → Model Router Contract implementation (owns routing _policy_ — tier selection, fallback chain order, cost ceilings, tenant BYO-key resolution) → self-hosted LiteLLM proxy (owns protocol _translation_ to the concrete provider API) → LLM provider. LiteLLM never owns routing policy; that remains the Model Router Contract's own abstraction, keeping LiteLLM a swappable implementation detail rather than a second, competing source of truth.

**Consequences:**

- The platform incurs no per-token third-party margin on top of its already-dominant AI inference cost line, at the cost of operating and maintaining one more self-hosted service.
- LiteLLM must be deployed multi-replica behind the API Gateway/internal load balancer from the first production environment to avoid becoming a single point of failure for all LLM traffic platform-wide (Risk Register RISK-009); this is a day-one requirement, not a later hardening task.
- Provider API keys and prompt/response traffic remain within AOS's own network boundary and Vault-managed secret custody (§3.22), simplifying the platform's data-handling posture relative to routing traffic through an external hosted intermediary.
- The Model Router Contract's own tier abstraction insulates the rest of the platform from LiteLLM implementation details, meaning a future swap to an alternative self-hosted, OpenAI-compatible proxy (if ever needed) would not require re-architecting Agent-facing code.

**Alternatives Considered:**

- **OpenRouter** — rejected as the primary path: as a third-party hosted intermediary, it adds its own commercial margin on top of every token processed at platform scale (a materially large absolute cost given AI inference's already-dominant share of total spend), and it becomes an additional vendor dependency sitting directly in the platform's highest-frequency, cost-sensitive call path — a direct violation of the vendor-lock-in-avoidance principle in master TSR §1. Retained narrowly as an optional fallback-provider entry for models not worth direct-integrating via LiteLLM.
- **Custom AI Gateway** — rejected: LiteLLM already solves the provider-protocol-translation problem well, across a wide (100+) and actively maintained provider catalog; building and indefinitely maintaining a custom equivalent against every provider's independently evolving API surface would be reinventing a solved, actively-maintained open-source component, directly contradicting Constitution §1.2.
