import { ExecutionValidationException } from "../errors/execution-validation-exception.js";
import { buildExecutionGraph } from "../graph/execution-graph.js";
import type { ExecutionValidationPipeline } from "../validator/execution-validation-pipeline.js";

import type {
  ExecutionMiddlewareContext,
  ExecutionMiddlewareNext,
  IExecutionMiddleware,
} from "./i-execution-middleware.js";

/** First stage: rejects an Execution Session whose runtime graph fails the `ExecutionValidationPipeline`. */
export class ValidationMiddleware implements IExecutionMiddleware {
  readonly name = "validation";

  constructor(private readonly validationPipeline: ExecutionValidationPipeline) {}

  async execute(context: ExecutionMiddlewareContext, next: ExecutionMiddlewareNext): Promise<void> {
    const graph = buildExecutionGraph(context.session.definition);
    const result = this.validationPipeline.run({ session: context.session, graph });
    if (!result.valid) {
      throw new ExecutionValidationException(
        `Execution "${context.session.context.token.workflowExecutionId}" failed validation: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    await next();
  }
}
