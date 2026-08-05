import type { IntegrationNamespace } from "../contracts/integration-namespace.js";
import type { IntegrationRequest } from "../contracts/integration-request.js";
import type { IntegrationResult } from "../contracts/integration-result.js";

import type { IIntegrationAdapter } from "./i-integration-adapter.js";

export interface BaseIntegrationAdapterOptions {
  readonly version?: string;
  readonly priority?: number;
}

/**
 * A thin, no-business-logic wrapper around one optional future-runtime contract — a
 * missing `runtime` is a normal "unavailable" outcome (`{success:false, error}`), never a
 * thrown exception, mirroring `@aos/workflow-execution`'s `ICapabilityExecutor` absence
 * handling. "Adapters wrap external runtimes. No business logic." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md).
 */
export abstract class BaseIntegrationAdapter<
  TRuntime extends { execute(request: IntegrationRequest): Promise<IntegrationResult> },
> implements IIntegrationAdapter {
  abstract readonly namespace: IntegrationNamespace;
  readonly version: string;
  readonly priority: number;

  constructor(
    readonly name: string,
    private readonly runtime?: TRuntime,
    options: BaseIntegrationAdapterOptions = {},
  ) {
    this.version = options.version ?? "1.0.0";
    this.priority = options.priority ?? 0;
  }

  isAvailable(): boolean {
    return this.runtime !== undefined;
  }

  async execute(request: IntegrationRequest): Promise<IntegrationResult> {
    if (!this.runtime) {
      return {
        success: false,
        error: `No runtime is configured for Adapter "${this.name}" (namespace "${this.namespace}")`,
      };
    }
    return this.runtime.execute(request);
  }
}
