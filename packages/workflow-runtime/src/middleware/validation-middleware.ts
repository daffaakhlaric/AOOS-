import { WorkflowValidationException } from "../errors/workflow-validation-exception.js";
import type { IWorkflowRuntimeValidator } from "../validator/i-workflow-runtime-validator.js";

import type {
  IRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** First stage: rejects an Instance whose Definition/Context fails `WorkflowRuntimeValidator` before any other middleware runs. */
export class ValidationMiddleware implements IRuntimeMiddleware {
  readonly name = "validation";

  constructor(private readonly validator: IWorkflowRuntimeValidator) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    const result = this.validator.validate(context.execution.definition, context.execution.context);
    if (!result.valid) {
      throw new WorkflowValidationException(
        `Workflow Instance "${context.execution.instance.token}" failed runtime validation: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    await next();
  }
}
