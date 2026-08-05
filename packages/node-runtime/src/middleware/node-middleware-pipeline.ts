import type { NodeExecution } from "../instance/node-execution.js";

import type { INodeMiddleware, NodeMiddlewareContext } from "./i-node-middleware.js";

/** A classic ordered middleware chain (`use()` appends, `execute()` runs them in order, each calling `next()` to continue) — the composition root every Runtime operation is dispatched through. */
export class NodeMiddlewarePipeline {
  private readonly middlewares: INodeMiddleware[] = [];

  use(middleware: INodeMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context: NodeMiddlewareContext): Promise<NodeExecution> {
    let lastIndexInvoked = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexInvoked) {
        throw new Error(
          "NodeMiddlewarePipeline: next() called more than once by the same middleware",
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
