import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";
import type { KnowledgeResult } from "../domain/knowledge-result.js";

/** The extension point `KnowledgePermissionResolver` calls; a future package can supply a real RBAC/ABAC-backed implementation (e.g. wrapping `@aos/knowledge-engine`'s `KnowledgePermissionEngine`) without this package changing. */
export interface IResultPermissionChecker {
  check(result: KnowledgeResult, context: KnowledgeQueryContext): boolean | Promise<boolean>;
}
