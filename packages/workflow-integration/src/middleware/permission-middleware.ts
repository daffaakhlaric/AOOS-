import { IntegrationPermissionException } from "../errors/integration-permission-exception.js";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { IWorkflowIntegrationPermissionChecker } from "./i-workflow-integration-permission-checker.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/** Second stage: defers to an optional injected `IWorkflowIntegrationPermissionChecker`; permissive by default with none configured. */
export class PermissionMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "permission";

  constructor(private readonly checker?: IWorkflowIntegrationPermissionChecker) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    if (this.checker) {
      const allowed = await this.checker.check(mwContext.context, mwContext.namespace);
      if (!allowed) {
        throw new IntegrationPermissionException(
          `Permission denied for namespace "${mwContext.namespace}" on Execution "${mwContext.context.token.workflowExecutionId}"`,
        );
      }
    }
    await next();
  }
}
