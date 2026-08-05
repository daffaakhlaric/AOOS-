import type { Logger } from "@aos/logger";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/** Ninth stage: structured before/after/error log lines for every integration attempt, via `@aos/logger`'s Pino-based `Logger`. */
export class LoggingMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "logging";

  constructor(private readonly logger: Logger) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    const { context, namespace } = mwContext;
    this.logger.info(
      { workflowExecutionId: context.token.workflowExecutionId, namespace },
      "workflow-integration attempt starting",
    );
    try {
      await next();
      this.logger.info(
        {
          workflowExecutionId: context.token.workflowExecutionId,
          namespace,
          success: mwContext.result?.success,
        },
        "workflow-integration attempt completed",
      );
    } catch (error) {
      this.logger.error(
        { workflowExecutionId: context.token.workflowExecutionId, namespace, error: String(error) },
        "workflow-integration attempt failed",
      );
      throw error;
    }
  }
}
