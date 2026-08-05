import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "./i-runtime-middleware.js";

/** Second stage: stamps `context.metadata.contextSeenAt` — the point every later stage can rely on `execution.context` having been observed once, without this package duplicating Context construction logic (that stays in `context/create-knowledge-runtime-context.ts`). */
export class ContextMiddleware implements IKnowledgeRuntimeMiddleware {
  readonly name = "context";

  async execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void> {
    context.metadata["contextSeenAt"] = new Date().toISOString();
    context.metadata["correlationId"] = context.execution.context.correlationId;
    await next();
  }
}
