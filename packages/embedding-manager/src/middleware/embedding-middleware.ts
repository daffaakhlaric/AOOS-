import type { EmbeddingExecution } from "../domain/embedding-execution.js";

export type EmbeddingMiddlewareNext = () => Promise<void>;

export type EmbeddingMiddlewareFn = (
  execution: EmbeddingExecution,
  next: EmbeddingMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE: Support embedding.use(...). Koa-style. Transport independent. Ordered
 * execution. Async capable." (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — a Koa-style
 * middleware chain a caller extends via `.use()`, with a double-`next()` guard.
 */
export class EmbeddingMiddleware {
  private readonly middlewares: EmbeddingMiddlewareFn[] = [];

  use(middleware: EmbeddingMiddlewareFn): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: EmbeddingExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Embedding Middleware");
      }
      lastIndexCalled = index;
      const middleware = this.middlewares[index];
      if (!middleware) {
        return;
      }
      await middleware(execution, () => dispatch(index + 1));
    };

    await dispatch(0);
  }

  get size(): number {
    return this.middlewares.length;
  }
}
