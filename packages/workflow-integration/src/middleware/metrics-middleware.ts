import type { IWorkflowIntegrationMetrics } from "../metrics/i-workflow-integration-metrics.js";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/** Fourth stage: records per-namespace Adapter Usage and the resolved Adapter's outcome, regardless of success/failure. */
export class MetricsMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "metrics";

  constructor(private readonly metrics: IWorkflowIntegrationMetrics) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    await next();
    if (mwContext.context.tenantId) {
      this.metrics.recordTenantUsage(mwContext.context.tenantId);
    }
  }
}
