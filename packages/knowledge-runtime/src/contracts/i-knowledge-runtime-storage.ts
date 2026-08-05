import type { KnowledgeRuntimeInstance } from "../domain/knowledge-runtime-instance.js";

/** Interface only — no implementation in this package. `KnowledgeRuntimeRegistry` is in-memory only; a future durable backend would implement this to persist Instances across process restarts. */
export interface IKnowledgeRuntimeStorage {
  save(instance: KnowledgeRuntimeInstance): Promise<void>;
  load(token: string): Promise<KnowledgeRuntimeInstance | undefined>;
  delete(token: string): Promise<void>;
}
