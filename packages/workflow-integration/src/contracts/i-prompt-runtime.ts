import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/** "IPromptRuntime — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION CONTRACTS"). Implementation belongs to a future Prompt Runtime Engineering Task. */
export interface IPromptRuntime {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
