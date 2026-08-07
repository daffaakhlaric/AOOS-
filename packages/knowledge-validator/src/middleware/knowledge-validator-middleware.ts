import type { KnowledgeValidationExecution } from "../domain/knowledge-validation-execution.js";

export type ValidatorMiddlewareNext = () => Promise<void>;

export type ValidatorMiddleware = (
  execution: KnowledgeValidationExecution,
  next: ValidatorMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE: Support validator.use(...). Koa-style. Transport independent. Ordered
 * execution. Async capable." (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — a Koa-style
 * middleware chain a caller extends via `.use()`, with a double-`next()` guard.
 */
export class KnowledgeValidatorMiddleware {
  private readonly middlewares: ValidatorMiddleware[] = [];

  use(middleware: ValidatorMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgeValidationExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Knowledge Validator Middleware");
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
