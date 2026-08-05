import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/** "IExperienceRuntime — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "INTEGRATION CONTRACTS"). Implementation belongs to a future Experience Runtime Engineering Task. */
export interface IExperienceRuntime {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
