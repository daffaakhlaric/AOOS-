import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/** "IAIGateway — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION CONTRACTS"). Implementation belongs to a future AI Gateway Engineering Task. */
export interface IAIGateway {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
