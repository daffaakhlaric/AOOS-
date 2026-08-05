import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/** "IKnowledgeRuntime — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION CONTRACTS"). Implementation belongs to a future Knowledge Runtime Engineering Task. */
export interface IKnowledgeRuntime {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
