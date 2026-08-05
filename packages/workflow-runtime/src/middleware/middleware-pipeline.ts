import type { WorkflowExecution } from "../instance/workflow-execution.js";

import type { IRuntimeMiddleware, RuntimeMiddlewareContext } from "./i-runtime-middleware.js";

/** A classic ordered middleware chain (`use()` appends, `execute()` runs them in order, each calling `next()` to continue) — the composition root every Runtime operation is dispatched through. */
export class RuntimeMiddlewarePipeline {
  private readonly middlewares: IRuntimeMiddleware[] = [];

  use(middleware: IRuntimeMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context: RuntimeMiddlewareContext): Promise<WorkflowExecution> {
    let lastIndexInvoked = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexInvoked) {
        throw new Error(
          "RuntimeMiddlewarePipeline: next() called more than once by the same middleware",
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
