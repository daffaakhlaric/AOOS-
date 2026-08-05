import type { KnowledgeSynchronizationExecution } from "../domain/knowledge-synchronization-execution.js";

export type SynchronizationMiddlewareNext = () => Promise<void>;

export type SynchronizationMiddleware = (
  execution: KnowledgeSynchronizationExecution,
  next: SynchronizationMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE PIPELINE: Validation → Permission → Policy → Tracing → Metrics →
 * Lifecycle → Logging → Custom Middleware. Support sync.use()."
 * (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — a Koa-style middleware chain a
 * caller extends via `.use()`, run by `KnowledgeSynchronizer` around each Synchronization
 * Execution once the real `KnowledgeSynchronizationPipeline` has already validated/
 * gated/resolved it. The 7 named built-in slots are pass-through hook points a caller's
 * Custom Middleware can observe or augment (e.g. attach an `IKnowledgeSynchronizationTracer`/
 * `IKnowledgeSynchronizationTelemetry`) — this package registers no real tracing/
 * logging/telemetry behavior itself, only the extensibility mechanism.
 */
export class KnowledgeSynchronizationMiddlewarePipeline {
  private readonly middlewares: SynchronizationMiddleware[] = [];

  use(middleware: SynchronizationMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgeSynchronizationExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Synchronization Middleware");
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
