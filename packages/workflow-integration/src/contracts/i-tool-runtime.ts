import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/** "IToolRuntime — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION CONTRACTS"). Implementation belongs to a future Tool Runtime Engineering Task. */
export interface IToolRuntime {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
