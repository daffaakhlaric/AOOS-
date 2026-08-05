import type { WorkflowExecution } from "../instance/workflow-execution.js";

/**
 * The mutable request-scoped context every Middleware in the pipeline shares.
 * `execution` is reassigned by `middleware/lifecycle-middleware.ts` (the terminal
 * middleware) to the post-transition result — every earlier middleware reads the
 * pre-transition `execution`.
 */
export interface RuntimeMiddlewareContext {
  execution: WorkflowExecution;
  readonly operation: string;
  readonly metadata: Record<string, unknown>;
}

export type RuntimeMiddlewareNext = () => Promise<void>;

/**
 * "Runtime Middleware" (user, 005.6B additional improvements) — Validation → Permission →
 * Tracing → Metrics → Lifecycle. Adding audit/billing/quota/observability later means
 * adding one more `IRuntimeMiddleware`, never touching the Workflow Runtime Core itself.
 */
export interface IRuntimeMiddleware {
  readonly name: string;
  execute(context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext): Promise<void>;
}
