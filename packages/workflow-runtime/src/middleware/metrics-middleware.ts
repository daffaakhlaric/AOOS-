import type { IWorkflowRuntimeMetrics } from "../metrics/i-workflow-runtime-metrics.js";

import type {
  IRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** Fourth stage: records Execution Latency for `context.operation` regardless of success/failure. */
export class MetricsMiddleware implements IRuntimeMiddleware {
  readonly name = "metrics";

  constructor(private readonly metrics: IWorkflowRuntimeMetrics) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    const startedAt = performance.now();
    try {
      await next();
    } finally {
      this.metrics.recordExecutionLatency(context.operation, performance.now() - startedAt);
    }
  }
}
