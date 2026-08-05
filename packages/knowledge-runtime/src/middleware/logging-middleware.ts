import type { IKnowledgeRuntimeLogger } from "./i-runtime-logger.js";
import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** Eighth (terminal) stage: structured before/after/error log lines for every Runtime operation. */
export class LoggingMiddleware implements IKnowledgeRuntimeMiddleware {
  readonly name = "logging";

  constructor(private readonly logger: IKnowledgeRuntimeLogger) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    const token = context.execution.instance.token;
    this.logger.info(
      { token, operation: context.operation },
      "knowledge-runtime operation starting",
    );
    try {
      await next();
      this.logger.info(
        { token, operation: context.operation, state: context.execution.instance.state },
        "knowledge-runtime operation completed",
      );
    } catch (error) {
      this.logger.error(
        { token, operation: context.operation, error: String(error) },
        "knowledge-runtime operation failed",
      );
      throw error;
    }
  }
}
