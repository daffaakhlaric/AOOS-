import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";

import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
} from "./i-runtime-middleware.js";

/**
 * "KnowledgeRuntimeMiddleware" (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md — "PUBLIC API") —
 * a classic ordered middleware chain (`use()` appends, `execute()` runs them in order,
 * each calling `next()` to continue). The composition root every Runtime operation is
 * dispatched through.
 */
export class KnowledgeRuntimeMiddleware {
  private readonly middlewares: IKnowledgeRuntimeMiddleware[] = [];

  use(middleware: IKnowledgeRuntimeMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context: RuntimeMiddlewareContext): Promise<KnowledgeRuntimeExecution> {
    let lastIndexInvoked = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexInvoked) {
        throw new Error(
          "KnowledgeRuntimeMiddleware: next() called more than once by the same middleware",
        );
      }
      lastIndexInvoked = index;
      const middleware = this.middlewares[index];
      if (!middleware) {
        return;
      }
      await middleware.execute(context, () => dispatch(index + 1));
    };

    await dispatch(0);
    return context.execution;
  }
}
