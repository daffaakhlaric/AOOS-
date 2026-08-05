import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";

/** The extension point `PermissionMiddleware` calls; a future package can supply a real RBAC/ABAC-backed implementation (e.g. wrapping `@aos/knowledge-engine`'s `KnowledgePermissionEngine`) without this package changing. */
export interface IKnowledgeRuntimePermissionChecker {
  check(execution: KnowledgeRuntimeExecution, operation: string): boolean | Promise<boolean>;
}
