import type { Logger } from "@aos/logger";

import type {
  INodeMiddleware,
  NodeMiddlewareContext,
  NodeMiddlewareNext,
} from "./i-node-middleware.js";

/**
 * Fifth stage: structured before/after log lines for every operation, via `@aos/logger`'s
 * Pino-based `Logger` (auto-enriched with trace/correlation/tenant ids from its
 * AsyncLocalStorage context — Constitution §17). New in 005.6C's "NODE MIDDLEWARE" list
 * (005.6B's pipeline had no Logging stage).
 */
export class LoggingMiddleware implements INodeMiddleware {
  readonly name = "logging";

  constructor(private readonly logger: Logger) {}

  async execute(context: NodeMiddlewareContext, next: NodeMiddlewareNext): Promise<void> {
    const { instance } = context.execution;
    this.logger.info(
      { nodeInstanceId: instance.id, nodeType: instance.type, operation: context.operation },
      "node-runtime operation starting",
    );
    try {
      await next();
      this.logger.info(
        {
          nodeInstanceId: instance.id,
          nodeType: instance.type,
          operation: context.operation,
          status: context.execution.instance.status,
        },
        "node-runtime operation completed",
      );
    } catch (error) {
      this.logger.error(
        {
          nodeInstanceId: instance.id,
          nodeType: instance.type,
          operation: context.operation,
          error: String(error),
        },
        "node-runtime operation failed",
      );
      throw error;
    }
  }
}
