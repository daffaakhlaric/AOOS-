import type { KnowledgeFreshnessEngine } from "../analysis/knowledge-freshness-engine.js";
import type { KnowledgeQualityScoringEngine } from "../scoring/knowledge-quality-scoring-engine.js";
import type { KnowledgeSimilarityEngine } from "../similarity/knowledge-similarity-engine.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { RecommendationType } from "../types/recommendation-type.js";
import { SimilarityClassification } from "../types/similarity-classification.js";
import type { KnowledgeRecommendation } from "../value-objects/knowledge-recommendation.js";

import type { KnowledgeRecommendationBuilder } from "./knowledge-recommendation-builder.js";

const LOW_USAGE_VIEW_COUNT = 2;
const SPLIT_CONTENT_LENGTH = 5000;
const LOW_QUALITY_THRESHOLD = 50;

/**
 * Real deterministic rules engine generating the 6 recommendation kinds (spec "Intelligence
 * Capabilities"): Merge (Duplicate pairs), Consolidation (Near-Duplicate pairs), Archive (stale +
 * low usage), Update (stale + used), Split (very long content), Improvement (low quality score,
 * the catch-all). Every rule is evaluated against caller-supplied structured signals only.
 */
export class KnowledgeRecommendationEngine {
  constructor(
    private readonly similarityEngine: KnowledgeSimilarityEngine,
    private readonly freshnessEngine: KnowledgeFreshnessEngine,
    private readonly qualityEngine: KnowledgeQualityScoringEngine,
    private readonly builder: KnowledgeRecommendationBuilder,
  ) {}

  generate(items: readonly KnowledgeItemSnapshot[]): readonly KnowledgeRecommendation[] {
    const recommendations: KnowledgeRecommendation[] = [];
    const handledForPairs = new Set<string>();

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i]!;
        const b = items[j]!;
        const entry = this.similarityEngine.compare(a, b);
        const pairKey = `${a.id}|${b.id}`;

        if (entry.classification === SimilarityClassification.Duplicate) {
          recommendations.push(
            this.builder.build({
              type: RecommendationType.Merge,
              itemIds: [a.id, b.id],
              reason: `Items ${a.id} and ${b.id} are near-identical (Jaccard ${entry.jaccard.toFixed(2)})`,
              priority: 90,
            }),
          );
          handledForPairs.add(pairKey);
        } else if (entry.classification === SimilarityClassification.NearDuplicate) {
          recommendations.push(
            this.builder.build({
              type: RecommendationType.Consolidation,
              itemIds: [a.id, b.id],
              reason: `Items ${a.id} and ${b.id} substantially overlap (Jaccard ${entry.jaccard.toFixed(2)})`,
              priority: 65,
            }),
          );
          handledForPairs.add(pairKey);
        }
      }
    }

    for (const item of items) {
      recommendations.push(...this.generateForItem(item));
    }

    return recommendations;
  }

  private generateForItem(item: KnowledgeItemSnapshot): readonly KnowledgeRecommendation[] {
    const recommendations: KnowledgeRecommendation[] = [];
    const stale = this.freshnessEngine.isStale(item);
    const lowUsage = (item.viewCount ?? 0) <= LOW_USAGE_VIEW_COUNT;

    if (stale && lowUsage) {
      recommendations.push(
        this.builder.build({
          type: RecommendationType.Archive,
          itemIds: [item.id],
          reason: `Item ${item.id} is stale and has low usage (viewCount=${item.viewCount ?? 0})`,
          priority: 55,
        }),
      );
    } else if (stale) {
      recommendations.push(
        this.builder.build({
          type: RecommendationType.Update,
          itemIds: [item.id],
          reason: `Item ${item.id} is stale but still actively used`,
          priority: 70,
        }),
      );
    }

    if (item.contentLength >= SPLIT_CONTENT_LENGTH) {
      recommendations.push(
        this.builder.build({
          type: RecommendationType.Split,
          itemIds: [item.id],
          reason: `Item ${item.id} content length (${item.contentLength}) exceeds the split threshold`,
          priority: 40,
        }),
      );
    }

    const quality = this.qualityEngine.score(item).value;
    if (quality < LOW_QUALITY_THRESHOLD) {
      recommendations.push(
        this.builder.build({
          type: RecommendationType.Improvement,
          itemIds: [item.id],
          reason: `Item ${item.id} quality score (${quality}) is below the improvement threshold`,
          priority: 60,
        }),
      );
    }

    return recommendations;
  }
}
