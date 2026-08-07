import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { SimilarityClassification } from "../types/similarity-classification.js";
import { cosineSimilarity, jaccardIndex } from "../utils/similarity-math.js";
import type { KnowledgeIntelligenceConfiguration } from "../value-objects/knowledge-intelligence-configuration.js";
import {
  KnowledgeSimilarityMatrix,
  type KnowledgeSimilarityEntry,
} from "../value-objects/knowledge-similarity-matrix.js";

/**
 * Real deterministic similarity engine: Jaccard index over each item's `tags` set (always
 * available) plus, when both items supply a `vector` of equal length, cosine similarity as a
 * secondary signal. The Jaccard score alone drives classification (spec calls for tag/keyword-set
 * based similarity as the primary signal); cosine is reported alongside for callers that supply
 * numeric feature vectors.
 */
export class KnowledgeSimilarityEngine {
  constructor(private readonly config: KnowledgeIntelligenceConfiguration) {}

  compare(a: KnowledgeItemSnapshot, b: KnowledgeItemSnapshot): KnowledgeSimilarityEntry {
    const jaccard = jaccardIndex(a.tags, b.tags);
    const cosine =
      a.vector && b.vector && a.vector.length === b.vector.length
        ? cosineSimilarity(a.vector, b.vector)
        : undefined;
    return {
      itemAId: a.id,
      itemBId: b.id,
      jaccard,
      cosine,
      classification: this.classify(jaccard),
    };
  }

  classify(jaccard: number): SimilarityClassification {
    const t = this.config.similarityThresholds;
    if (jaccard >= t.duplicate) return SimilarityClassification.Duplicate;
    if (jaccard >= t.nearDuplicate) return SimilarityClassification.NearDuplicate;
    if (jaccard >= t.related) return SimilarityClassification.Related;
    return SimilarityClassification.Distinct;
  }

  buildMatrix(items: readonly KnowledgeItemSnapshot[]): KnowledgeSimilarityMatrix {
    const entries: KnowledgeSimilarityEntry[] = [];
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        entries.push(this.compare(items[i]!, items[j]!));
      }
    }
    return new KnowledgeSimilarityMatrix(entries);
  }
}
