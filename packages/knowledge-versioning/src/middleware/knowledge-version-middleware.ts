import type { KnowledgeVersionExecution } from "../domain/knowledge-version-execution.js";

export type VersionMiddlewareNext = () => Promise<void>;

export type VersionMiddleware = (
  execution: KnowledgeVersionExecution,
  next: VersionMiddlewareNext,
) => void | Promise<void>;

/**
 * "MIDDLEWARE: Support version.use(...). Requirements: Koa-style middleware. Transport
 * independent. Extensible. Ordered execution." (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md)
 * — a Koa-style middleware chain a caller extends via `.use()`, run by
 * `KnowledgeVersioning` around each Version Operation once the real
 * `KnowledgeVersionPipeline` has already validated/gated/transitioned it. Separate from
 * the Pipeline — the Pipeline's 8 stages are fixed and internal; this chain is the
 * caller-extensible observation/augmentation point.
 */
export class KnowledgeVersionMiddleware {
  private readonly middlewares: VersionMiddleware[] = [];

  use(middleware: VersionMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async run(execution: KnowledgeVersionExecution): Promise<void> {
    let lastIndexCalled = -1;

    const dispatch = async (index: number): Promise<void> => {
      if (index <= lastIndexCalled) {
        throw new Error("next() called multiple times in one Version Middleware");
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
