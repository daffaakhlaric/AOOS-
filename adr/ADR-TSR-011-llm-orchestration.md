# ADR-TSR-011 — LLM Orchestration: Custom Runtime Against AOS's Own Contracts

**Status:** Accepted

**Context:** doc 003.5 (`003.5-CONTRACT-FIRST-DESIGN.md`) already fully specifies the Agent, Planner, Reasoner, Reflection, Memory, and Tool Contracts — the formal, JSON-Schema-backed definition of what a valid Agent, Plan, reasoning step, reflection cycle, memory access, and tool invocation _is_ on the AOS platform. Constitution RULE-001, RULE-003, and RULE-004 require that Agents never call external systems directly (only via the Tool Manager), that Prompts are resolved from the Prompt Registry, and that Workflows are resolved from the Workflow Registry — never from a third-party framework's own configuration format. Every publicly available LLM orchestration framework (LangGraph, Mastra, CrewAI, AutoGen, Semantic Kernel) ships its own opinionated, non-negotiable notion of "agent," "tool," and "memory," none of which was designed with AOS's Contracts in mind, because AOS's Contracts did not exist when they were designed and are not a target any of them optimizes for.

**Decision:** AOS builds a **Custom Runtime** implementing the Planner/Reasoner/Reflection Contracts' execution logic directly, with no third-party orchestration framework adopted as the platform's Agent/Tool/Memory abstraction. Selective reuse of a framework's internal execution engine (e.g., LangGraph's graph-based state machine) as a scoped library dependency inside one Custom Runtime module is explicitly permitted, provided it is never exposed as the platform's own abstraction and never bypasses the Tool Manager, Prompt Registry, or Workflow Registry resolution paths mandated by RULE-001/003/004.

**Consequences:**

- Higher upfront engineering investment than adopting an off-the-shelf orchestration framework; the Custom Runtime's reliability and edge-case robustness must be earned through AOS's own Simulation Contract-gated testing discipline (Architecture ADR-013) rather than inherited from a battle-tested framework's production history.
- Zero abstraction conflict between "what the Contracts say an Agent is" and "what the runtime actually executes" — there is exactly one representation, not two reconciled at runtime.
- Zero orchestration-framework vendor lock-in on the platform's most central runtime layer; the only durable dependency is on AOS's own Contract Specification, which is not lock-in in the vendor-risk sense.
- Guardrail, cost-ceiling, and permission enforcement (Constitution RULE-008, doc 002 ADR-010/ADR-016/ADR-018) remain single-path and non-bypassable, since no framework-native security/permission model exists in parallel to reconcile against.
- No external community, examples, or third-party bug-fix pool exists for this layer; onboarding relies on doc 003.5 and internal documentation rather than public framework docs.
- Framework execution engines remain available as implementation accelerators for specific Custom Runtime modules, preserving ecosystem value without importing ecosystem-imposed abstraction.

**Alternatives Considered:**

- **LangGraph as the platform's orchestration layer** (rejected: its `StateGraph`/node-edge model and message-passing conventions would compete with, not implement, the Planner Contract's `ExecutionPlan`/`Task`/`SubTask` model — the largest and most mature ecosystem of the candidates, which is precisely why it is named explicitly as the correct target for selective internal reuse rather than dismissed outright).
- **Mastra as the platform's orchestration layer** (rejected: TypeScript-native and philosophically closer to AOS's stack than the Python-first alternatives, but still imposes its own Agent/Workflow/Tool/Memory primitives that would need reconciling against doc 003.5's Contracts).
- **CrewAI as the platform's orchestration layer** (rejected: role-based "Crew" model is a further, and further removed, abstraction; weakest fit of the candidate set for a Contract-First platform).
- **AutoGen as the platform's orchestration layer** (rejected: Microsoft-backed multi-agent conversation model does not map cleanly onto AOS's Planner/Reasoner/Reflection separation of concerns).
- **Semantic Kernel as the platform's orchestration layer** (rejected: its Plugin/Planner/Kernel abstraction is the closest naming collision with AOS's own Planner Contract, which makes the abstraction-conflict risk more, not less, acute — same "Planner" word, different and incompatible meaning).
- **Do nothing / defer the decision** (rejected: Core Runtime implementation cannot begin per doc 003.5 §25 Acceptance Criteria without a concrete execution engine behind the Contracts; deferral is not a valid TSR outcome per doc 003.5 §26 roadmap item 4).
