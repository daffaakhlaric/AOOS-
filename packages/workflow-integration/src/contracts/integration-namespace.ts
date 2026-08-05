/**
 * "The package MUST know every contract." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md).
 * The 9 Adapter/Resolver namespaces this package knows about — one per "ADAPTER LAYER"
 * entry. `IAIGateway` has no dedicated Adapter of its own (the prompt's Adapter Layer
 * lists 9, not 10) — `adapter/model-adapter.ts` accepts both an optional `IModelRouter`
 * and an optional `IAIGateway`, since routing to a model and gating access to an AI
 * provider are two facets of the same "which model backend do we call" concern.
 */
export enum IntegrationNamespace {
  CAPABILITY = "capability",
  TOOL = "tool",
  CONNECTOR = "connector",
  KNOWLEDGE = "knowledge",
  MEMORY = "memory",
  PROMPT = "prompt",
  MODEL = "model",
  AGENT = "agent",
  EXPERIENCE = "experience",
}

/**
 * "Resolver: Capability → Tool → Connector → Knowledge → Memory → Prompt → Model → Agent
 * → Experience." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "RESOLVER"). The
 * authoritative resolution order `WorkflowIntegrationResolver#resolveChain()` walks.
 */
export const INTEGRATION_RESOLUTION_ORDER: readonly IntegrationNamespace[] = [
  IntegrationNamespace.CAPABILITY,
  IntegrationNamespace.TOOL,
  IntegrationNamespace.CONNECTOR,
  IntegrationNamespace.KNOWLEDGE,
  IntegrationNamespace.MEMORY,
  IntegrationNamespace.PROMPT,
  IntegrationNamespace.MODEL,
  IntegrationNamespace.AGENT,
  IntegrationNamespace.EXPERIENCE,
];
