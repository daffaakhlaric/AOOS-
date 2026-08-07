import type { KnowledgeRollback } from "../domain/knowledge-rollback.js";

/** Interface only — no implementation in this package ("Rollback contracts" only). An external provider that actually restores stored content for a recorded `KnowledgeRollback`. */
export interface IKnowledgeRollbackProvider {
  rollback(record: KnowledgeRollback): void | Promise<void>;
}
