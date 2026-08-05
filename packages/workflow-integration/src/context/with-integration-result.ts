import { IntegrationNamespace } from "../contracts/integration-namespace.js";
import type { IntegrationResult } from "../contracts/integration-result.js";

import type { WorkflowIntegrationContext } from "./workflow-integration-context.js";

/**
 * "INTEGRATION CONTEXT ... CapabilityResult, KnowledgeResult, MemoryResult, ToolResult,
 * ConnectorResult, ModelResult, PromptResult, AgentResult." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md)
 * — exactly 8 result slots for 9 Adapter namespaces. `EXPERIENCE` has no dedicated slot in
 * the prompt's field list; its result is published as an Event only (`events/`), never
 * persisted onto the Context — a deliberate, documented asymmetry, not an oversight.
 */
const RESULT_FIELD_BY_NAMESPACE: Readonly<
  Partial<Record<IntegrationNamespace, keyof WorkflowIntegrationContext>>
> = {
  [IntegrationNamespace.CAPABILITY]: "capabilityResult",
  [IntegrationNamespace.TOOL]: "toolResult",
  [IntegrationNamespace.CONNECTOR]: "connectorResult",
  [IntegrationNamespace.KNOWLEDGE]: "knowledgeResult",
  [IntegrationNamespace.MEMORY]: "memoryResult",
  [IntegrationNamespace.PROMPT]: "promptResult",
  [IntegrationNamespace.MODEL]: "modelResult",
  [IntegrationNamespace.AGENT]: "agentResult",
};

/** Returns a new `WorkflowIntegrationContext` with the `*Result` slot matching `namespace` populated, if one exists — see `RESULT_FIELD_BY_NAMESPACE` for the `EXPERIENCE` exception. */
export function withIntegrationResult(
  context: WorkflowIntegrationContext,
  namespace: IntegrationNamespace,
  result: IntegrationResult,
): WorkflowIntegrationContext {
  const field = RESULT_FIELD_BY_NAMESPACE[namespace];
  if (!field) {
    return context;
  }
  return { ...context, [field]: result };
}
