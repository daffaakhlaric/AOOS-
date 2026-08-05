import { WorkflowExecutionException } from "../errors/workflow-execution-exception.js";

import type {
  ExecutionMiddlewareContext,
  ExecutionMiddlewareNext,
  IExecutionMiddleware,
} from "./i-execution-middleware.js";
import type { IExecutionPermissionChecker } from "./i-execution-permission-checker.js";

/** Second stage: defers to an optional injected `IExecutionPermissionChecker`; permissive by default with none configured. */
export class PermissionMiddleware implements IExecutionMiddleware {
  readonly name = "permission";

  constructor(private readonly checker?: IExecutionPermissionChecker) {}

  async execute(context: ExecutionMiddlewareContext, next: ExecutionMiddlewareNext): Promise<void> {
    if (this.checker) {
      const allowed = await this.checker.check(context.session, context.operation);
      if (!allowed) {
        throw new WorkflowExecutionException(
          `Permission denied for operation "${context.operation}" on Execution "${context.session.context.token.workflowExecutionId}"`,
        );
      }
    }
    await next();
  }
}
