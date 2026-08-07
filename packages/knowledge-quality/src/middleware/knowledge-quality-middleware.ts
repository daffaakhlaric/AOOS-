import type { KnowledgeQualityExecution } from "../domain/knowledge-quality-execution.js";

export type QualityMiddlewareNext = () => Promise<void>;

export type QualityMiddleware = (
  execution: KnowledgeQualityExecution,
  next: QualityMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE: Support quality.use(...). Koa-style. Transport independent. Ordered
 * execution. Async capable." (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — a Koa-style
 * middleware chain a caller extends via `.use()`, with a double-`next()` guard.
 */
export class KnowledgeQualityMiddleware {
  private readonly middlewares: QualityMiddleware[] = [];

  use(middleware: QualityMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgeQualityExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Knowledge Quality Middleware");
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
