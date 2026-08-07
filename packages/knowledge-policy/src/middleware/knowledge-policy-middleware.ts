import type { KnowledgePolicyExecution } from "../domain/knowledge-policy-execution.js";

export type PolicyMiddlewareNext = () => Promise<void>;

export type PolicyMiddleware = (
  execution: KnowledgePolicyExecution,
  next: PolicyMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE: Support policy.use(...). Requirements: Koa-style middleware. Transport
 * independent. Extensible. Ordered execution." (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md)
 * — a Koa-style middleware chain a caller extends via `.use()`.
 */
export class KnowledgePolicyMiddleware {
  private readonly middlewares: PolicyMiddleware[] = [];

  use(middleware: PolicyMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgePolicyExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Policy Middleware");
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
