import type { IExecutionMetrics } from "../metrics/i-execution-metrics.js";

import type {
  ExecutionMiddlewareContext,
  ExecutionMiddlewareNext,
  IExecutionMiddleware,
} from "./i-execution-middleware.js";

/** Fourth stage: records Operation Latency regardless of success/failure. */
export class MetricsMiddleware implements IExecutionMiddleware {
  readonly name = "metrics";

  constructor(private readonly metrics: IExecutionMetrics) {}

  async execute(context: ExecutionMiddlewareContext, next: ExecutionMiddlewareNext): Promise<void> {
    const startedAt = performance.now();
    try {
      await next();
    } finally {
      this.metrics.recordOperationLatency(context.operation, performance.now() - startedAt);
    }
  }
}
