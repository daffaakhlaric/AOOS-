import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";

/**
 * The mutable request-scoped context every Middleware in the pipeline shares. `execution`
 * is reassigned by `middleware/lifecycle-middleware.ts` (the terminal state-changing
 * stage) to the post-transition result — every earlier middleware reads the
 * pre-transition `execution`.
 */
export interface RuntimeMiddlewareContext {
  execution: KnowledgeRuntimeExecution;
  readonly operation: string;
  readonly metadata: Record<string, unknown>;
}

export type RuntimeMiddlewareNext = () => Promise<void>;

/**
 * "RUNTIME MIDDLEWARE: Validation → Permission → Policy → Tracing → Metrics → Lifecycle →
 * Logging → Custom Middleware." (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — adding
 * audit/billing/quota/observability later means registering one more
 * `IKnowledgeRuntimeMiddleware` via `runtime.use()`, never touching Knowledge Runtime
 * Core itself.
 */
export interface IKnowledgeRuntimeMiddleware {
  readonly name: string;
  execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void>;
}
