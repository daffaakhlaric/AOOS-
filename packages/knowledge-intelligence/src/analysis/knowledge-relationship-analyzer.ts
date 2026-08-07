import type { KnowledgeSimilarityEngine } from "../similarity/knowledge-similarity-engine.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { SimilarityClassification } from "../types/similarity-classification.js";
import { sharedElementCount } from "../utils/similarity-math.js";

export interface DiscoveredRelationship {
  readonly sourceId: string;
  readonly targetId: string;
  readonly strength: number;
  readonly basis: "similarity" | "shared_tags" | "explicit_link";
}

/**
 * Real, deterministic relationship discovery: two items are related if (a) the caller already
 * declared an explicit link, (b) their similarity-engine Jaccard score classifies as anything but
 * Distinct, or (c) they share at least `minSharedTags` tags. No ML — pure set/graph logic over
 * caller-supplied structured fields.
 */
export class KnowledgeRelationshipAnalyzer {
  constructor(
    private readonly similarityEngine: KnowledgeSimilarityEngine,
    private readonly minSharedTags = 2,
  ) {}

  discover(items: readonly KnowledgeItemSnapshot[]): readonly DiscoveredRelationship[] {
    const results: DiscoveredRelationship[] = [];

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i]!;
        const b = items[j]!;

        if (a.linkedItemIds?.includes(b.id) || b.linkedItemIds?.includes(a.id)) {
          results.push({ sourceId: a.id, targetId: b.id, strength: 1, basis: "explicit_link" });
          continue;
        }

        const entry = this.similarityEngine.compare(a, b);
        if (entry.classification !== SimilarityClassification.Distinct) {
          results.push({
            sourceId: a.id,
            targetId: b.id,
            strength: entry.jaccard,
            basis: "similarity",
          });
          continue;
        }

        const shared = sharedElementCount(a.tags, b.tags);
        if (shared >= this.minSharedTags) {
          results.push({
            sourceId: a.id,
            targetId: b.id,
            strength: shared / Math.max(a.tags.length, b.tags.length, 1),
            basis: "shared_tags",
          });
        }
      }
    }

    return results;
  }
}
