import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { SimilarityClassification } from "../types/similarity-classification.js";
import type { KnowledgeSimilarityEntry } from "../value-objects/knowledge-similarity-matrix.js";

import type { KnowledgeSimilarityEngine } from "./knowledge-similarity-engine.js";

/**
 * Classifies every pair in a corpus as Duplicate / Near-Duplicate using the shared
 * `KnowledgeSimilarityEngine`'s configured thresholds — a thin, purpose-named facade so callers
 * that only care about duplicate detection don't need to build a full similarity matrix
 * themselves.
 */
export class KnowledgeDuplicateDetector {
  constructor(private readonly similarityEngine: KnowledgeSimilarityEngine) {}

  findDuplicates(items: readonly KnowledgeItemSnapshot[]): readonly KnowledgeSimilarityEntry[] {
    return this.findByClassification(items, SimilarityClassification.Duplicate);
  }

  findNearDuplicates(items: readonly KnowledgeItemSnapshot[]): readonly KnowledgeSimilarityEntry[] {
    return this.findByClassification(items, SimilarityClassification.NearDuplicate);
  }

  private findByClassification(
    items: readonly KnowledgeItemSnapshot[],
    classification: SimilarityClassification,
  ): readonly KnowledgeSimilarityEntry[] {
    const results: KnowledgeSimilarityEntry[] = [];
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const entry = this.similarityEngine.compare(items[i]!, items[j]!);
        if (entry.classification === classification) results.push(entry);
      }
    }
    return results;
  }
}
