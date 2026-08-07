import type { KnowledgeMerge } from "../domain/knowledge-merge.js";

/** Interface only — no implementation in this package. An external resolver that settles content conflicts arising from a recorded `KnowledgeMerge` — conflict detection and resolution are both out of scope here. */
export interface IKnowledgeConflictResolver {
  resolve(merge: KnowledgeMerge, conflicts: readonly unknown[]): unknown | Promise<unknown>;
}
