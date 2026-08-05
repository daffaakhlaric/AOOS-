import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { KnowledgeChangeRecord } from "../domain/knowledge-change-record.js";

/** Interface only — no implementation in this package. "Only metadata detection. No content parsing." Backs the Pipeline's Change Detection stage; permissive (no changes) when unconfigured. */
export interface IKnowledgeSynchronizationChangeDetector {
  readonly id: string;
  detect(context: KnowledgeSynchronizationContext): Promise<readonly KnowledgeChangeRecord[]>;
}
