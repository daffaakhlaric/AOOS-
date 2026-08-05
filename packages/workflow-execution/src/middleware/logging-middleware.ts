import type { Logger } from "@aos/logger";

import type {
  ExecutionMiddlewareContext,
  ExecutionMiddlewareNext,
  IExecutionMiddleware,
} from "./i-execution-middleware.js";

/** Fifth stage: structured before/after/error log lines for every operation, via `@aos/logger`'s Pino-based `Logger`. */
export class LoggingMiddleware implements IExecutionMiddleware {
  readonly name = "logging";

  constructor(private readonly logger: Logger) {}

  async execute(context: ExecutionMiddlewareContext, next: ExecutionMiddlewareNext): Promise<void> {
    const { token } = context.session.context;
    this.logger.info(
      { workflowExecutionId: token.workflowExecutionId, operation: context.operation },
      "workflow-execution operation starting",
    );
    try {
      await next();
      this.logger.info(
        {
          workflowExecutionId: token.workflowExecutionId,
          operation: context.operation,
          state: context.session.context.currentState,
        },
        "workflow-execution operation completed",
      );
    } catch (error) {
      this.logger.error(
        {
          workflowExecutionId: token.workflowExecutionId,
          operation: context.operation,
          error: String(error),
        },
        "workflow-execution operation failed",
      );
      throw error;
    }
  }
}
