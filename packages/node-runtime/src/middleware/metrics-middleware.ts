import type { INodeRuntimeMetrics } from "../metrics/i-node-runtime-metrics.js";

import type {
  INodeMiddleware,
  NodeMiddlewareContext,
  NodeMiddlewareNext,
} from "./i-node-middleware.js";

/** Fourth stage: records Execution Latency for `context.operation` regardless of success/failure. */
export class MetricsMiddleware implements INodeMiddleware {
  readonly name = "metrics";

  constructor(private readonly metrics: INodeRuntimeMetrics) {}

  async execute(context: NodeMiddlewareContext, next: NodeMiddlewareNext): Promise<void> {
    const startedAt = performance.now();
    try {
      await next();
    } finally {
      this.metrics.recordExecutionLatency(context.operation, performance.now() - startedAt);
    }
  }
}
