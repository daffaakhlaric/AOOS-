import type { KnowledgeMarketplaceExecution } from "../domain/knowledge-marketplace-execution.js";

export type MarketplaceMiddlewareNext = () => Promise<void>;

export type MarketplaceMiddleware = (
  execution: KnowledgeMarketplaceExecution,
  next: MarketplaceMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE: Support marketplace.use(...). Koa-style. Transport independent."
 * (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — a Koa-style middleware chain a caller
 * extends via `.use()`.
 */
export class KnowledgeMarketplaceMiddleware {
  private readonly middlewares: MarketplaceMiddleware[] = [];

  use(middleware: MarketplaceMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgeMarketplaceExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Marketplace Middleware");
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
