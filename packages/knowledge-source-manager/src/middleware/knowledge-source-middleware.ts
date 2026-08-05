import type { KnowledgeSourceExecution } from "../domain/knowledge-source-execution.js";

export type SourceMiddlewareNext = () => Promise<void>;

export type SourceMiddleware = (
  execution: KnowledgeSourceExecution,
  next: SourceMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE PIPELINE: Validation -> Permission -> Policy -> Tracing -> Metrics ->
 * Lifecycle -> Logging -> Custom Middleware. Support source.use()."
 * (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — a Koa-style middleware chain a
 * caller extends via `.use()`, run by `KnowledgeSourceManager` around each Source
 * Execution once the real `KnowledgeSourcePipeline` has already validated/gated/
 * registered it. The 7 named built-in slots are pass-through hook points a caller's
 * Custom Middleware can observe or augment — this package registers no real
 * tracing/logging/telemetry behavior itself, only the extensibility mechanism.
 */
export class KnowledgeSourceMiddlewarePipeline {
  private readonly middlewares: SourceMiddleware[] = [];

  use(middleware: SourceMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgeSourceExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Source Middleware");
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
