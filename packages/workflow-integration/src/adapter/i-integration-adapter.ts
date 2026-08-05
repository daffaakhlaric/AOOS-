import type { IntegrationNamespace } from "../contracts/integration-namespace.js";
import type { IntegrationRequest } from "../contracts/integration-request.js";
import type { IntegrationResult } from "../contracts/integration-result.js";

/** "Adapters wrap external runtimes. No business logic." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "ADAPTER LAYER"). The common shape every concrete Adapter (`CapabilityAdapter`, `ToolAdapter`, ...) satisfies. */
export interface IIntegrationAdapter {
  readonly name: string;
  readonly namespace: IntegrationNamespace;
  readonly version: string;
  readonly priority: number;
  isAvailable(): boolean;
  execute(request: IntegrationRequest): Promise<IntegrationResult>;
}
