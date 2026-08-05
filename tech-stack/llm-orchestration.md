# Tech Stack Detail — LLM Orchestration

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.11 · TSR Category 11 · ADR-TSR-011

**Status:** ACTIVE. This file expands, and does not alter, the Final Recommendation already made in TSR §3.11.

---

## 1. Objective

Choose (or reject) a framework to implement the _execution logic_ behind the Agent, Planner, Reasoner, Reflection, Memory, and Tool Contracts already fully specified in `docs/003.5-CONTRACT-FIRST-DESIGN.md`. This is not a "pick an agent framework" decision in the conventional sense — doc 003.5 has already fixed the platform's own abstraction (what a valid Agent/Plan/Reasoning-step/Reflection/Tool-call _is_, as JSON Schema, per contract §2–§9). The question this category answers is narrower and stricter: **does any existing LLM orchestration framework deserve to sit underneath that already-fixed abstraction, or does the abstraction have to be executed by code AOS writes and owns?**

## 2. Requirements

- MUST NOT impose its own opinionated notion of "Agent," "Tool," "Memory," or "Plan" that competes with or must be reconciled against the Agent/Planner/Reasoner/Reflection/Memory/Tool Contracts (doc 003.5 §2–§8).
- MUST be compatible with Constitution RULE-001 (Agents never call external systems directly — only via Tool Manager), RULE-003 (Prompts resolved from Prompt Registry, not framework config), RULE-004 (Workflows resolved from Workflow Registry).
- MUST support the Planner Contract's `ExecutionPlan`/`Task`/`SubTask`/`Dependency` structure, the Reasoner Contract's `Problem`/`Evidence`/`Hypothesis`/`Decision`/`Confidence` structure, and the Reflection Contract's `TaskReview`/`QualityScore`/`ImprovementPlan` structure as first-class outputs, not as data force-fit into a foreign schema.
- MUST allow the Model Router Contract (§14) to remain the sole LLM-provider abstraction — no framework-native provider client bypassing LiteLLM (TSR §3.10).
- SHOULD minimize reinvention of genuinely hard, already-solved sub-problems (deterministic graph/state-machine execution, retry/backoff plumbing) where that reinvention is not required to preserve Contract fidelity — this is the one dimension weighing _toward_ selective adoption of framework internals as libraries, not a whole-orchestration-layer adoption.

## 3. Candidate Technologies

| Candidate       | What it is                                                                              | Native abstraction it imposes                                          |
| --------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| LangGraph       | Graph/state-machine execution library for LLM agents (LangChain ecosystem)              | Its own `StateGraph`, node/edge model, and message-passing conventions |
| Mastra          | TypeScript-native agent framework                                                       | Its own Agent/Workflow/Tool primitives and Memory abstraction          |
| CrewAI          | Multi-agent "crew"/role-based orchestration framework (Python)                          | Its own Agent/Crew/Task/Process model                                  |
| AutoGen         | Multi-agent conversation framework (Microsoft)                                          | Its own Conversable Agent / GroupChat model                            |
| Semantic Kernel | LLM orchestration SDK (Microsoft, .NET/Python/Java)                                     | Its own Plugin/Planner/Kernel abstraction                              |
| Custom Runtime  | Code built directly against the Agent/Planner/Reasoner/Reflection/Memory/Tool Contracts | None — the Contracts _are_ the abstraction                             |

## 4. Evaluation Matrix

Scoring: 1 (worst) – 5 (best). All columns score in the "higher is better" direction, including Vendor Lock-in Risk and Estimated Cost, where 5 = lowest risk / lowest cost.

| Dimension                                                      | LangGraph                                        | Mastra    | CrewAI | AutoGen | Semantic Kernel | Custom Runtime                                                       |
| -------------------------------------------------------------- | ------------------------------------------------ | --------- | ------ | ------- | --------------- | -------------------------------------------------------------------- |
| Performance                                                    | 4                                                | 4         | 3      | 3       | 3               | 4 (no framework overhead, but unproven until built)                  |
| Scalability                                                    | 3                                                | 3         | 2      | 3       | 3               | 4 (designed to AOS's actual multi-tenant model from day one)         |
| Reliability                                                    | 3                                                | 3         | 2      | 3       | 3               | 3 (unproven initially; matures with AOS's own test suite)            |
| Security                                                       | 3                                                | 3         | 3      | 3       | 3               | 5 (permissions/guardrails are native Contract fields, not bolted on) |
| Maintainability                                                | 2 (fighting a second abstraction long-term)      | 2         | 2      | 2       | 2               | 4 (one abstraction, not two)                                         |
| Developer Experience                                           | 4 (short-term, greenfield)                       | 4         | 3      | 3       | 3               | 2 (short-term — no framework scaffolding); improves over time        |
| Ecosystem                                                      | 5                                                | 3         | 3      | 3       | 4               | 1 (no external ecosystem; internal only)                             |
| Community Maturity                                             | 5                                                | 2 (young) | 3      | 4       | 4               | 1 (new, internal)                                                    |
| Licensing                                                      | 5 (MIT/Apache-2.0 class)                         | 5         | 5      | 5 (MIT) | 5 (MIT)         | 5 (fully owned)                                                      |
| Cloud Compatibility                                            | 4                                                | 4         | 4      | 4       | 4               | 5 (no assumptions baked in)                                          |
| Vendor Lock-in Risk                                            | 2 (LangChain ecosystem coupling)                 | 3         | 3      | 3       | 3               | 5 (zero — it is AOS's own code)                                      |
| Estimated Cost (build/maintain effort, not runtime infra cost) | 4 (cheap to adopt, expensive to reconcile later) | 4         | 4      | 4       | 4               | 2 (higher upfront engineering cost)                                  |

**Reading this matrix:** every framework candidate scores well on short-term adoption dimensions (DX, Ecosystem, Community Maturity, initial Cost) and poorly on the dimensions that matter for a platform whose abstraction is already fixed by contract (Maintainability, Vendor Lock-in Risk, Security-as-native-fields). Custom Runtime inverts that pattern. This is the expected, intended shape of the matrix for this category — see §16 Final Recommendation for why the framework-favorable columns do not win the decision.

## 5. Benchmark

No proprietary AOS benchmarking exists yet (pre-implementation decision record). Directionally, publicly reported LangGraph/CrewAI/AutoGen benchmarks focus on task-completion-rate and multi-agent conversation quality on public agentic benchmarks (e.g., GAIA-style evaluations) — these measure _prompting and orchestration-graph design quality_, not raw runtime throughput, and are not comparable to a "framework vs. no framework" performance question. The one performance-relevant, framework-agnostic fact worth stating plainly: LLM inference latency (typically hundreds of milliseconds to several seconds per call) dwarfs any orchestration-layer overhead a framework or a custom runtime would add (typically single-digit milliseconds of coordination logic) — so this category's performance dimension is not the deciding factor in practice, consistent with its middling weight in the decision matrix (`decision-matrix/llm-orchestration.md`).

## 6. Performance

A Custom Runtime built directly against the Contracts has no framework-imposed serialization/translation step between "what the Contract says a Plan is" and "what the code executes" — there is exactly one representation of a Plan, not two (the Contract's and the framework's) reconciled at runtime. Frameworks are not disqualified on raw performance; they are disqualified on structural grounds (§16). Where a framework's _internal engine_ (e.g., LangGraph's graph executor) is reused as a library dependency inside one Custom Runtime module, its performance characteristics are inherited without the abstraction conflict — this is the explicitly permitted selective-reuse pattern.

## 7. Scalability

The Custom Runtime is designed against AOS's actual multi-tenant execution model from the outset (per-tenant fair-share via Queue Contract, tenant-scoped Agent instances, per-invocation `cost_limit`/`token_limit`) rather than a framework's single-tenant-first design retrofitted with multi-tenancy. None of the candidate frameworks were built with a thousands-of-tenant SaaS operating model as a first-class concern; each would require a non-trivial multi-tenancy adaptation layer regardless of adoption path, which is itself an argument for building that layer once, correctly, as part of the Custom Runtime rather than twice (once inside the framework's assumptions, once around it).

## 8. Reliability

Framework maturity (LangGraph's LangChain-ecosystem battle-testing in particular) is real and not dismissed — it is a genuine short-term reliability advantage over a from-scratch runtime. This is explicitly why the Custom Runtime scores only "3" (parity, not superiority) on Reliability in the matrix, and why the Trade-off in §16 is stated honestly rather than glossed over: reliability is _earned_ by the Custom Runtime over the first production cycles (backed by the Simulation Contract's mandatory pre-production gate, Architecture ADR-013), not assumed on day one the way an already-hardened framework's would be.

## 9. Security

This is where Custom Runtime's advantage is least debatable: permission scoping, cost ceilings, and Guardrail invocation are already first-class Contract fields (Agent Contract's `permissions`/`cost_limit`/`security_level`, Tool Contract's `permission_scope`, doc 002 ADR-010/ADR-018). A third-party framework's own security model (if any) would need to be reconciled with, not replace, these Contract-level guarantees — adopting a framework whole-cloth risks a second, competing enforcement path that could diverge from the Guardrail Engine's authority, which Constitution RULE-008 and ADR-016 (fail-closed Guardrail behavior) do not tolerate.

## 10. Maintainability

Two abstractions layered on top of each other (AOS's Contracts _and_ a framework's native Agent/Tool/Memory model) is a long-term maintainability tax every future engineer pays on every change — precisely the "leaky, doubly-abstracted system" the Final Recommendation (§16) names as the core objection. A single abstraction (the Contracts, executed by Custom Runtime code) is the one path that keeps "what a valid Agent is" answerable by reading one document (doc 003.5), not two.

## 11. Developer Experience

Short-term DX favors the frameworks — a new engineer can be productive against LangGraph or Mastra's documentation and examples faster than against an internal, evolving Custom Runtime with less external documentation. This is a real, acknowledged cost (see Trade-off, §16), mitigated over time by the Custom Runtime's DX converging toward "read the Contract spec, the Contract _is_ the API," which is arguably a _better_ long-run DX for a platform where the Contract Specification is already the single source of truth engineers are expected to work from (doc 003.5 §1.2).

## 12. Ecosystem

Frameworks unambiguously win here — LangGraph in particular benefits from the wider LangChain ecosystem's integrations, examples, and community tooling. This ecosystem value is preserved, not discarded, through the selective-internal-reuse pattern (§16): AOS can still depend on LangGraph as a _library_ for a specific execution-engine concern inside the Planner Contract's implementation, gaining ecosystem value without ecosystem-imposed abstraction lock-in.

## 13. Community Maturity

AutoGen (Microsoft-backed) and Semantic Kernel (Microsoft-backed, multi-language) have strong institutional backing; LangGraph has the largest and most active open-source community of the set. A from-scratch Custom Runtime starts with zero external community and depends entirely on AOS's own engineering investment — a genuine, named risk (see `risk/risk-register.md` RISK-012-adjacent consideration: internal-only tooling has no external bug-fix/contribution pool), mitigated by keeping the Custom Runtime's scope narrow (Contract execution only) rather than reinventing every general-purpose capability a mature framework also offers.

## 14. Licensing

All six candidates are permissively licensed (MIT or Apache-2.0 class for the frameworks; the Custom Runtime is fully AOS-owned code). Licensing is not a differentiator in this category, unlike Cache (§3.6) or Search Engine (§3.14) where a relicensing event was decisive.

## 15. Cloud Compatibility

All candidates are cloud-agnostic runtime libraries/code with no infrastructure assumptions baked in; this dimension does not differentiate the candidates for this category. The Custom Runtime, deployed as containerized Core Runtime services per Architecture §11, inherits AOS's existing Kubernetes-based cloud compatibility (TSR §3.20) directly.

## 16. Vendor Lock-in

This is the second-most decisive dimension after Maintainability. Adopting any framework as the platform's orchestration abstraction means every future Agent/Planner/Reasoner change is filtered through that framework's release cadence, breaking-change policy, and design philosophy — a dependency directly contrary to TSR §1's guiding philosophy point 2 (avoid vendor/framework lock-in wherever the operational burden of avoiding it is acceptable) and point 3 (Contract-First compatibility is a hard filter, disqualifying regardless of popularity). The Custom Runtime has, by construction, zero orchestration-framework lock-in — its only "lock-in" is to AOS's own Contract Specification, which is not lock-in in the vendor sense; it is the platform's own durable interface (doc 003.5 §1.2).

## 17. Estimated Cost

See [`cost-analysis/cost-model-100-1000-10000-dealers.md`](../cost-analysis/cost-model-100-1000-10000-dealers.md). LLM Orchestration itself is not a line item in that cost model — it is engineering effort (a one-time-ish build cost plus ongoing maintenance), not metered infrastructure spend, unlike the AI/LLM Inference line (which is the dominant cost driver at every scale per §5 of the TSR and is a function of the Model Router/AI Gateway choice, §3.10, not the orchestration layer). The Custom Runtime's cost is front-loaded (higher initial build effort than adopting a framework, reflected as a "2" on Estimated Cost in the matrix) and is treated as an accepted, deliberate trade-off rather than a discovered one — see §18 Trade-offs.

## 18. Pros

- Zero abstraction conflict with the already-specified Agent/Planner/Reasoner/Reflection/Memory/Tool Contracts.
- Zero framework-vendor lock-in on the platform's single most central runtime layer.
- Native, first-class enforcement of Constitution RULE-001/003/004/008 and Guardrail/cost-ceiling invariants, with no second competing enforcement path.
- Full control over multi-tenant execution semantics from day one.
- Selective reuse of framework internals (e.g., LangGraph's graph engine) remains available as an implementation accelerator without abstraction cost.

## 19. Cons

- Higher upfront engineering investment than adopting an off-the-shelf framework.
- No external community, examples, or third-party bug-fix pool for the orchestration layer itself.
- Reliability and edge-case robustness must be earned through AOS's own testing/Simulation Contract discipline rather than inherited from a battle-tested framework.
- Onboarding engineers unfamiliar with AOS's Contract Specification has a steeper initial ramp than onboarding onto a well-documented public framework.

## 20. Trade-offs

Building a Custom Runtime is more upfront engineering effort than adopting an off-the-shelf orchestration framework. This is accepted as the direct, unavoidable consequence of doc 003.5 already having specified AOS's own Agent/Planner/Reasoner/Reflection Contracts in full: those Contracts _are_ the orchestration model. Adopting a second, framework-supplied orchestration model on top would not be complementary — it would be redundant at best and actively conflicting (two competing notions of "what an Agent is") at worst. The mitigations are (a) selective internal reuse of framework execution engines as library dependencies scoped to a single module, never exposed as the platform's abstraction, and (b) treating framework source code as a design reference during Custom Runtime implementation, without adopting its public API surface.

## 21. Final Recommendation

**Custom Runtime**, built directly against the Agent/Planner/Reasoner/Reflection/Memory/Tool Contracts already specified in doc 003.5. Every framework in the candidate list (LangGraph, Mastra, CrewAI, AutoGen, Semantic Kernel) ships its own opinionated notion of "agent," "tool," and "memory." Adopting any of them wholesale as the platform's orchestration layer would mean either (a) fighting the framework's abstractions to force-fit AOS's own Contracts on top, producing a leaky, doubly-abstracted system, or (b) abandoning AOS's own Contract Specification in favor of the framework's model, directly contradicting Constitution RULE-001/003/004 (Agents/Tools/Prompts must be resolved from AOS's own Registries, not a third-party framework's config format). This is a rejection of every candidate framework **as the platform's orchestration abstraction** — it is explicitly not a rejection of their engineering value wholesale.

**Selective internal reuse is still appropriate and recommended.** LangGraph's graph-based state-machine execution model is a reasonable _internal implementation detail_ inside the Planner Contract's execution engine — i.e., a library dependency of one internal module, never exposed as the platform's own abstraction. This is an implementation accelerator to be evaluated properly at Core Runtime build time, not "the orchestration layer" for the platform.

This matches, without alteration, the Final Recommendation already made in TSR §3.11.

## 22. ADR Reference

[`adr/ADR-TSR-011-llm-orchestration.md`](../adr/ADR-TSR-011-llm-orchestration.md)

## 23. Migration Strategy

There is no "default + escape hatch" migration pair for this category the way there is for Database or Vector Database — the Custom Runtime is the only recommended path, so `migration/migration-and-upgrade-strategy.md` does not carry a named migration trigger for LLM Orchestration. The relevant forward-looking discipline instead is: if a specific Custom Runtime module's execution engine (e.g., the Planner's graph execution) proves to be a maintenance burden AOS's own team cannot keep pace with, the correct response is to evaluate swapping that module's _internal_ library dependency (e.g., adopt LangGraph's engine internally where previously hand-rolled) — never to swap the platform's orchestration abstraction itself. Any such internal library swap is implementation-detail-scoped and does not require a TSR amendment; a change to the Custom-Runtime-vs-framework decision itself would require revisiting this ADR explicitly.

## 24. Future Consideration

- Re-evaluate specific framework _execution engines_ (not their full abstraction) as internal library candidates once Core Runtime implementation begins and concrete engineering pain points (e.g., building a robust DAG scheduler for Planner's `ExecutionPlan`) are measured rather than anticipated.
- Monitor the LLM orchestration framework landscape for a genuinely Contract-agnostic, "bring your own schema" execution engine — none of the current candidates (LangGraph, Mastra, CrewAI, AutoGen, Semantic Kernel) offer this today, but the category is evolving quickly and this constraint could be revisited if one emerges.
- If AOS's Contract Specification itself evolves toward a shape closer to an existing framework's model (convergent design, not adoption), reassess whether the gap has narrowed enough to change this recommendation — this would be a deliberate TSR amendment, not an incidental drift.
