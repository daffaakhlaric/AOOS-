import { IntegrationValidationException } from "../errors/integration-validation-exception.js";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/** Sixth stage: when `allowedEnvironments` is configured, rejects a Context whose `environment` is not in the allow-list. */
export class EnvironmentMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "environment";

  constructor(private readonly allowedEnvironments?: readonly string[]) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    const environment = mwContext.context.environment;
    if (
      this.allowedEnvironments &&
      environment &&
      !this.allowedEnvironments.includes(environment)
    ) {
      throw new IntegrationValidationException(
        `Integration for namespace "${mwContext.namespace}" is not allowed in environment "${environment}"`,
      );
    }
    await next();
  }
}
