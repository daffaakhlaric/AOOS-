import type { KnowledgeRuntimeContext } from "../context/knowledge-runtime-context.js";

import type { KnowledgeRuntimeInstance } from "./knowledge-runtime-instance.js";

/** A point-in-time copy of an Instance's `KnowledgeRuntimeInstance` + `KnowledgeRuntimeContext` — "No persistence"; `KnowledgeRuntimeManager` only ever holds these in memory. */
export interface KnowledgeRuntimeSnapshot {
  readonly id: string;
  readonly instanceToken: string;
  readonly sequence: number;
  readonly capturedAt: string;
  readonly instance: KnowledgeRuntimeInstance;
  readonly context: KnowledgeRuntimeContext;
}
