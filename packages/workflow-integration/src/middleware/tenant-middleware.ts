import { IntegrationValidationException } from "../errors/integration-validation-exception.js";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/** Fifth stage: when `requireTenantId` is configured, rejects a Context with no `tenantId` before it reaches Retry/Timeout/the terminal Adapter call. */
export class TenantMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "tenant";

  constructor(private readonly requireTenantId = false) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    if (this.requireTenantId && !mwContext.context.tenantId) {
      throw new IntegrationValidationException(
        `Integration for namespace "${mwContext.namespace}" requires a tenantId but none was supplied`,
      );
    }
    await next();
  }
}
