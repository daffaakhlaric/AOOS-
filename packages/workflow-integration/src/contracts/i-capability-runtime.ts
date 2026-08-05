import type { IntegrationRequest } from "./integration-request.js";
import type { IntegrationResult } from "./integration-result.js";

/**
 * "ICapabilityRuntime — NO implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md —
 * "INTEGRATION CONTRACTS"). Implementation belongs to a future Capability Runtime
 * Engineering Task; `adapter/capability-adapter.ts` only ever calls this interface,
 * never a concrete Capability itself.
 */
export interface ICapabilityRuntime {
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
