/** Interface only — no optimization logic in this package. "Prepare Index Merge, Index Split, Compaction, Vacuum, Rebuild." `KnowledgeIndexOptimizer` (the Public API class) delegates every operation to an injected implementation of this contract. */
export interface IKnowledgeIndexOptimizer {
  merge(indexType: string): Promise<void>;
  split(indexType: string): Promise<void>;
  compact(indexType: string): Promise<void>;
  vacuum(indexType: string): Promise<void>;
  rebuild(indexType: string): Promise<void>;
}
