import type { IIntegrationAdapter } from "../adapter/i-integration-adapter.js";
import {
  INTEGRATION_RESOLUTION_ORDER,
  IntegrationNamespace,
} from "../contracts/integration-namespace.js";
import { AdapterNotFoundException } from "../errors/adapter-not-found-exception.js";
import type {
  ResolveAdapterOptions,
  WorkflowIntegrationRegistry,
} from "../registry/workflow-integration-registry.js";

import type { IWorkflowIntegrationResolver } from "./i-workflow-integration-resolver.js";

/**
 * "Resolver: Capability → Tool → Connector → Knowledge → Memory → Prompt → Model → Agent
 * → Experience. Only resolution. Never execution." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md).
 * A thin lookup layer over `WorkflowIntegrationRegistry` — never calls `Adapter#execute()`.
 */
export class WorkflowIntegrationResolver implements IWorkflowIntegrationResolver {
  constructor(private readonly registry: WorkflowIntegrationRegistry) {}

  resolve(namespace: IntegrationNamespace, options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.registry.resolve(namespace, options);
  }

  resolveCapability(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.CAPABILITY, options);
  }

  resolveTool(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.TOOL, options);
  }

  resolveConnector(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.CONNECTOR, options);
  }

  resolveKnowledge(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.KNOWLEDGE, options);
  }

  resolveMemory(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.MEMORY, options);
  }

  resolvePrompt(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.PROMPT, options);
  }

  resolveModel(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.MODEL, options);
  }

  resolveAgent(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.AGENT, options);
  }

  resolveExperience(options?: ResolveAdapterOptions): IIntegrationAdapter {
    return this.resolve(IntegrationNamespace.EXPERIENCE, options);
  }

  /** Resolves every namespace in `INTEGRATION_RESOLUTION_ORDER`, silently skipping any with no registered Adapter. */
  resolveChain(
    options?: ResolveAdapterOptions,
  ): ReadonlyMap<IntegrationNamespace, IIntegrationAdapter> {
    const resolved = new Map<IntegrationNamespace, IIntegrationAdapter>();
    for (const namespace of INTEGRATION_RESOLUTION_ORDER) {
      try {
        resolved.set(namespace, this.resolve(namespace, options));
      } catch (error) {
        if (!(error instanceof AdapterNotFoundException)) {
          throw error;
        }
      }
    }
    return resolved;
  }
}
