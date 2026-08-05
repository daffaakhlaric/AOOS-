import type { KnowledgeChangeRecord } from "../domain/knowledge-change-record.js";
import type { KnowledgeConflictResolutionStrategy } from "../domain/knowledge-conflict-resolution-strategy.js";

/** Interface only — no implementation in this package. "CONFLICT RESOLUTION ... No implementation." A future resolver (Last Write Wins/Version Based/Manual Approval/Merge/Custom — see `KnowledgeConflictResolutionStrategy`) reconciles conflicting `KnowledgeChangeRecord`s. */
export interface IKnowledgeSynchronizationConflictResolver {
  readonly id: string;
  readonly strategy: KnowledgeConflictResolutionStrategy;
  resolve(changes: readonly KnowledgeChangeRecord[]): Promise<readonly KnowledgeChangeRecord[]>;
}
