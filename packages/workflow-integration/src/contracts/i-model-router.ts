import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/** "IModelRouter — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION CONTRACTS"). Implementation belongs to a future Model Router Engineering Task. */
export interface IModelRouter {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
