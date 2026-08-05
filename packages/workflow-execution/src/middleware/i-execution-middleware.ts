import type { ExecutionSession } from "../engine/execution-session.js";

export interface ExecutionMiddlewareContext {
  session: ExecutionSession;
  readonly operation: string;
  readonly metadata: Record<string, unknown>;
}

export type ExecutionMiddlewareNext = () => Promise<void>;

/** "MIDDLEWARE: Execution Middleware. Validation, Permission, Tracing, Metrics, Logging, Lifecycle. Extensible." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md). */
export interface IExecutionMiddleware {
  readonly name: string;
  execute(context: ExecutionMiddlewareContext, next: ExecutionMiddlewareNext): Promise<void>;
}
