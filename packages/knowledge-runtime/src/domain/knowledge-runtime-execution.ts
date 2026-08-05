import type { KnowledgeRuntimeContext } from "../context/knowledge-runtime-context.js";

import type { KnowledgeRuntimeHistory } from "./knowledge-runtime-history.js";
import type { KnowledgeRuntimeInstance } from "./knowledge-runtime-instance.js";

/**
 * The unit every State Machine transition / Middleware stage reads and returns —
 * `instance` + `context` + the ordered `history` of every transition so far. Mirrors
 * `@aos/workflow-runtime`'s `WorkflowExecution` triple, with `history` promoted to a
 * top-level field since Knowledge Runtime has no execution graph/definition to carry.
 */
export interface KnowledgeRuntimeExecution {
  readonly instance: KnowledgeRuntimeInstance;
  readonly context: KnowledgeRuntimeContext;
  readonly history: KnowledgeRuntimeHistory;
}
