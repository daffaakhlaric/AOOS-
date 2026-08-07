import type { KnowledgeGeneratorExecution } from "../domain/knowledge-generator-execution.js";

export type GeneratorMiddlewareNext = () => Promise<void>;

export type GeneratorMiddleware = (
  execution: KnowledgeGeneratorExecution,
  next: GeneratorMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE: Support generator.use(...). Koa-style. Transport independent. Ordered
 * execution. Async capable." (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — a Koa-style
 * middleware chain a caller extends via `.use()`, with a double-`next()` guard.
 */
export class KnowledgeGeneratorMiddleware {
  private readonly middlewares: GeneratorMiddleware[] = [];

  use(middleware: GeneratorMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgeGeneratorExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Knowledge Generator Middleware");
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
