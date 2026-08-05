import type { WorkflowExecution } from "../instance/workflow-execution.js";

/** "SECURITY: Permission Interface" (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md) — the extension point `middleware/permission-middleware.ts` calls; a future package can supply a real RBAC/ABAC-backed implementation without this package changing. */
export interface IPermissionChecker {
  check(execution: WorkflowExecution, operation: string): boolean | Promise<boolean>;
}
