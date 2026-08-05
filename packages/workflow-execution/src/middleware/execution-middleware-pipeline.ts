import type { ExecutionSession } from "../engine/execution-session.js";

import type { ExecutionMiddlewareContext, IExecutionMiddleware } from "./i-execution-middleware.js";

/** A classic ordered middleware chain (`use()` appends, `execute()` runs them in order, each calling `next()` to continue). */
export class ExecutionMiddlewarePipeline {
  private readonly middlewares: IExecutionMiddleware[] = [];

  use(middleware: IExecutionMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context: ExecutionMiddlewareContext): Promise<ExecutionSession> {
    let lastIndexInvoked = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexInvoked) {
        throw new Error(
          "ExecutionMiddlewarePipeline: next() called more than once by the same middleware",
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
    return context.session;
  }
}
