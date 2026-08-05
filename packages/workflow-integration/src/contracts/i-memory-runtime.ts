import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/** "IMemoryRuntime — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION CONTRACTS"). Implementation belongs to a future Memory Runtime Engineering Task. */
export interface IMemoryRuntime {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
