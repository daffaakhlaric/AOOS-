import type { IAIGateway } from "../contracts/i-ai-gateway.js";
import type { IModelRouter } from "../contracts/i-model-router.js";
import { IntegrationNamespace } from "../contracts/integration-namespace.js";
import type { IntegrationRequest } from "../contracts/integration-request.js";
import type { IntegrationResult } from "../contracts/integration-result.js";

import type { BaseIntegrationAdapterOptions } from "./base-integration-adapter.js";
import type { IIntegrationAdapter } from "./i-integration-adapter.js";

export interface ModelAdapterRuntimes {
  readonly modelRouter?: IModelRouter;
  readonly aiGateway?: IAIGateway;
}

/**
 * Wraps both an optional `IModelRouter` and an optional `IAIGateway` — the only Adapter
 * with two backing contracts, since "IAIGateway" has no dedicated Adapter of its own in
 * the source prompt's "ADAPTER LAYER" list (see `contracts/integration-namespace.ts`).
 * Prefers `modelRouter` when both are configured; falls back to `aiGateway`.
 */
export class ModelAdapter implements IIntegrationAdapter {
  readonly namespace = IntegrationNamespace.MODEL;
  readonly version: string;
  readonly priority: number;
  private readonly modelRouter?: IModelRouter;
  private readonly aiGateway?: IAIGateway;

  constructor(
    readonly name: string,
    runtimes: ModelAdapterRuntimes = {},
    options: BaseIntegrationAdapterOptions = {},
  ) {
    this.modelRouter = runtimes.modelRouter;
    this.aiGateway = runtimes.aiGateway;
    this.version = options.version ?? "1.0.0";
    this.priority = options.priority ?? 0;
  }

  isAvailable(): boolean {
    return this.modelRouter !== undefined || this.aiGateway !== undefined;
  }

  async execute(request: IntegrationRequest): Promise<IntegrationResult> {
    if (this.modelRouter) {
      return this.modelRouter.execute(request);
    }
    if (this.aiGateway) {
      return this.aiGateway.execute(request);
    }
    return {
      success: false,
      error: `No IModelRouter or IAIGateway is configured for Adapter "${this.name}" (namespace "${this.namespace}")`,
    };
  }
}
