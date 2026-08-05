import type { ExecutionSession } from "../engine/execution-session.js";

/** "SECURITY"-equivalent extension point for this package — the same pattern used by `@aos/workflow-runtime`/`@aos/node-runtime`. */
export interface IExecutionPermissionChecker {
  check(session: ExecutionSession, operation: string): boolean | Promise<boolean>;
}
