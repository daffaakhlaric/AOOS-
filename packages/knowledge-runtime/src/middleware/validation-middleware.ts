import { RuntimeValidationException } from "../errors/runtime-validation-exception.js";
import type { KnowledgeRuntimeValidator } from "../validator/knowledge-runtime-validator.js";

import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

export interface ValidationMiddlewareOptions {
  readonly allowedTenantIds?: readonly string[];
  readonly allowedWorkspaceIds?: readonly string[];
}

/** First stage: rejects an Instance/Context that fails `KnowledgeRuntimeValidator` before any other middleware runs. */
export class ValidationMiddleware implements IKnowledgeRuntimeMiddleware {
  readonly name = "validation";

  constructor(
    private readonly validator: KnowledgeRuntimeValidator,
    private readonly options: ValidationMiddlewareOptions = {},
  ) {}

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    const result = this.validator.validate({
      execution: context.execution,
      allowedTenantIds: this.options.allowedTenantIds,
      allowedWorkspaceIds: this.options.allowedWorkspaceIds,
    });
    if (!result.valid) {
      throw new RuntimeValidationException(
        `Knowledge Runtime Instance "${context.execution.instance.token}" failed runtime validation: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    await next();
  }
}
