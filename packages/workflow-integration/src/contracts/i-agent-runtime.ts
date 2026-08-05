import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/** "IAgentRuntime — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION CONTRACTS"). Implementation belongs to a future Agent Runtime Engineering Task. */
export interface IAgentRuntime {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
