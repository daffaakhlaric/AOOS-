import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { KnowledgeChangeRecord } from "../domain/knowledge-change-record.js";
import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";

export interface KnowledgeSynchronizationCommitInput {
  readonly job: KnowledgeSynchronizationJob;
  readonly context: KnowledgeSynchronizationContext;
  readonly changes: readonly KnowledgeChangeRecord[];
}

/** Interface only — no implementation in this package. Backs the Pipeline's Commit stage; permissive no-op when unconfigured. Distinct from `IKnowledgeSynchronizationStorage` — a Committer finalizes one Pipeline run's resolved Changes, a Storage persists the full completed Execution afterward. */
export interface IKnowledgeSynchronizationCommitter {
  readonly id: string;
  commit(input: KnowledgeSynchronizationCommitInput): Promise<void>;
}
