import type { NodeExecution } from "../instance/node-execution.js";

/**
 * The mutable request-scoped context every Middleware in the pipeline shares.
 * `execution` is reassigned by `middleware/lifecycle-middleware.ts` (the terminal
 * middleware) to the post-transition result — every earlier middleware reads the
 * pre-transition `execution`.
 */
export interface NodeMiddlewareContext {
  execution: NodeExecution;
  readonly operation: string;
  readonly metadata: Record<string, unknown>;
}

export type NodeMiddlewareNext = () => Promise<void>;

/**
 * "NODE MIDDLEWARE: Implement middleware pipeline. Validation, Permission, Tracing,
 * Metrics, Logging, Lifecycle. Allow runtime.use()." (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md).
 */
export interface INodeMiddleware {
  readonly name: string;
  execute(context: NodeMiddlewareContext, next: NodeMiddlewareNext): Promise<void>;
}
