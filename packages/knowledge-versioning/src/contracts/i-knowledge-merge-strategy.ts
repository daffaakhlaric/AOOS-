import type { KnowledgeMerge } from "../domain/knowledge-merge.js";

/** Interface only — no implementation in this package ("No merge algorithm."). An external engine that actually merges the content behind a recorded `KnowledgeMerge`. */
export interface IKnowledgeMergeStrategy {
  readonly name: string;
  apply(merge: KnowledgeMerge): unknown | Promise<unknown>;
}
