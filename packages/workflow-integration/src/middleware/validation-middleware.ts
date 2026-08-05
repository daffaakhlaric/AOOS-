import { IntegrationValidationException } from "../errors/integration-validation-exception.js";
import type { WorkflowIntegrationRegistry } from "../registry/workflow-integration-registry.js";
import { WorkflowIntegrationValidator } from "../validator/workflow-integration-validator.js";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/** First stage: rejects an integration attempt whose Registry fails `WorkflowIntegrationValidator`. */
export class ValidationMiddleware implements IWorkflowIntegrationMiddleware {
  readonly name = "validation";

  constructor(
    private readonly registry: WorkflowIntegrationRegistry,
    private readonly validator: WorkflowIntegrationValidator = new WorkflowIntegrationValidator(),
  ) {}

  async execute(
    mwContext: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void> {
    const result = this.validator.validate({ registry: this.registry, context: mwContext.context });
    if (!result.valid) {
      throw new IntegrationValidationException(
        `Integration for namespace "${mwContext.namespace}" failed validation: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    await next();
  }
}
