import type { IIntegrationAdapter } from "../adapter/i-integration-adapter.js";
import type { IntegrationNamespace } from "../contracts/integration-namespace.js";
import type { ResolveAdapterOptions } from "../registry/workflow-integration-registry.js";

/** "RESOLVER: Only resolution. Never execution." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). */
export interface IWorkflowIntegrationResolver {
  resolve(namespace: IntegrationNamespace, options?: ResolveAdapterOptions): IIntegrationAdapter;
  resolveChain(
    options?: ResolveAdapterOptions,
  ): ReadonlyMap<IntegrationNamespace, IIntegrationAdapter>;
}
