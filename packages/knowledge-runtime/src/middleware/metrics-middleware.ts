import type { IKnowledgeRuntimeMetrics } from "../metrics/i-knowledge-runtime-metrics.js";

import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** Sixth stage: records Tenant/Workspace Usage for every operation, regardless of success/failure. */
export class MetricsMiddleware implements IKnowledgeRuntimeMiddleware {
  readonly name = "metrics";

  constructor(private readonly metrics: IKnowledgeRuntimeMetrics) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    this.metrics.recordTenantUsage(context.execution.context.tenantId);
    const { workspaceId } = context.execution.context;
    if (workspaceId !== undefined) {
      this.metrics.recordWorkspaceUsage(workspaceId);
    }
    await next();
  }
}
