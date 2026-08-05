import { NodeValidationException } from "../errors/node-validation-exception.js";
import type { ValidationPipeline } from "../validator/validation-pipeline.js";

import type {
  INodeMiddleware,
  NodeMiddlewareContext,
  NodeMiddlewareNext,
} from "./i-node-middleware.js";

/** First stage: rejects a Node Instance whose Manifest/Config/Context fails the `ValidationPipeline` before any other middleware runs. */
export class ValidationMiddleware implements INodeMiddleware {
  readonly name = "validation";

  constructor(private readonly validationPipeline: ValidationPipeline) {}

  async execute(context: NodeMiddlewareContext, next: NodeMiddlewareNext): Promise<void> {
    const result = this.validationPipeline.run(context.execution);
    if (!result.valid) {
      throw new NodeValidationException(
        `Node Instance "${context.execution.instance.id}" failed runtime validation: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    await next();
  }
}
