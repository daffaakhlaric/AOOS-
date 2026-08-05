import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";

/** The extension point `PolicyMiddleware` calls; a future package can supply a real implementation (e.g. wrapping `@aos/knowledge-engine`'s `KnowledgePolicyEngine`) without this package changing. */
export interface IKnowledgeRuntimePolicyChecker {
  check(execution: KnowledgeRuntimeExecution, operation: string): boolean | Promise<boolean>;
}
