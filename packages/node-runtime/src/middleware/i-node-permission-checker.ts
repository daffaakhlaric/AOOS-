import type { NodeExecution } from "../instance/node-execution.js";

/** "SECURITY: Permission Interface" (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md) — the extension point `middleware/permission-middleware.ts` calls. */
export interface INodePermissionChecker {
  check(execution: NodeExecution, operation: string): boolean | Promise<boolean>;
}
