import type { SimilarityClassification } from "../types/similarity-classification.js";

export interface KnowledgeSimilarityEntry {
  readonly itemAId: string;
  readonly itemBId: string;
  readonly jaccard: number;
  readonly cosine: number | undefined;
  readonly classification: SimilarityClassification;
}

/** Immutable pairwise similarity matrix over a corpus (upper-triangular entry list). */
export class KnowledgeSimilarityMatrix {
  readonly entries: readonly KnowledgeSimilarityEntry[];

  constructor(entries: readonly KnowledgeSimilarityEntry[]) {
    for (const entry of entries) {
      if (entry.jaccard < 0 || entry.jaccard > 1) {
        throw new RangeError("KnowledgeSimilarityMatrix: jaccard must be within [0, 1]");
      }
    }
    this.entries = entries;
    Object.freeze(this.entries);
    Object.freeze(this);
  }

  entriesFor(itemId: string): readonly KnowledgeSimilarityEntry[] {
    return this.entries.filter((e) => e.itemAId === itemId || e.itemBId === itemId);
  }

  entriesByClassification(
    classification: SimilarityClassification,
  ): readonly KnowledgeSimilarityEntry[] {
    return this.entries.filter((e) => e.classification === classification);
  }
}
