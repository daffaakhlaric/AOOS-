import type { KnowledgeProviderExecution } from "../domain/knowledge-provider-execution.js";

export type ProviderMiddlewareNext = () => Promise<void>;

export type ProviderMiddleware = (
  execution: KnowledgeProviderExecution,
  next: ProviderMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE PIPELINE: Validation → Permission → Policy → Tracing → Metrics →
 * Lifecycle → Logging → Custom Middleware. Support provider.use()."
 * (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md) — a Koa-style middleware chain a caller
 * extends via `.use()`, run by `KnowledgeProvider` around each Provider Execution once
 * the real `KnowledgeProviderPipeline` has already validated/gated/resolved it. The 7
 * named built-in slots are pass-through hook points a caller's Custom Middleware can
 * observe or augment — this package registers no real tracing/logging/telemetry
 * behavior itself, only the extensibility mechanism.
 */
export class KnowledgeProviderMiddlewarePipeline {
  private readonly middlewares: ProviderMiddleware[] = [];

  use(middleware: ProviderMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgeProviderExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Provider Middleware");
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
