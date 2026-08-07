import type { KnowledgeInsightBuilder } from "../recommendation/knowledge-insight-builder.js";
import type { KnowledgeInsight } from "../value-objects/knowledge-insight.js";

export interface InsightSourceData {
  readonly totalItems: number;
  readonly duplicatePairCount: number;
  readonly nearDuplicatePairCount: number;
  readonly gapCount: number;
  readonly orphanCount: number;
  readonly staleItemCount: number;
  readonly averageHealthScore: number;
  readonly duplicateItemIds: readonly string[];
  readonly orphanItemIds: readonly string[];
}

/**
 * Real rule-based corpus-level insight generation: turns aggregated pipeline results (duplicate
 * counts, gap counts, orphan counts, staleness counts, average health) into human-readable
 * `KnowledgeInsight` observations with a deterministically-assigned severity.
 */
export class KnowledgeInsightEngine {
  constructor(private readonly builder: KnowledgeInsightBuilder) {}

  generate(data: InsightSourceData): readonly KnowledgeInsight[] {
    const insights: KnowledgeInsight[] = [];

    if (data.duplicatePairCount > 0) {
      insights.push(
        this.builder.build({
          title: `${data.duplicatePairCount} duplicate pair(s) detected`,
          description: "One or more knowledge item pairs are near-identical and should be merged.",
          severity: "critical",
          relatedItemIds: data.duplicateItemIds,
        }),
      );
    }

    if (data.nearDuplicatePairCount > 0) {
      insights.push(
        this.builder.build({
          title: `${data.nearDuplicatePairCount} near-duplicate pair(s) detected`,
          description: "Items overlap substantially and are candidates for consolidation.",
          severity: "warning",
        }),
      );
    }

    if (data.gapCount > 0) {
      insights.push(
        this.builder.build({
          title: `${data.gapCount} coverage gap(s) detected`,
          description: "One or more taxonomy topics have no covering knowledge item.",
          severity: "warning",
        }),
      );
    }

    if (data.orphanCount > 0) {
      insights.push(
        this.builder.build({
          title: `${data.orphanCount} orphaned item(s) detected`,
          description: "Items with zero relationships to the rest of the corpus were found.",
          severity: "info",
          relatedItemIds: data.orphanItemIds,
        }),
      );
    }

    if (data.staleItemCount > 0) {
      insights.push(
        this.builder.build({
          title: `${data.staleItemCount} stale item(s) detected`,
          description: "Items exceed the configured freshness age threshold.",
          severity: "warning",
        }),
      );
    }

    insights.push(
      this.builder.build({
        title: `Average corpus health score is ${data.averageHealthScore}`,
        description: `Computed across ${data.totalItems} analyzed item(s).`,
        severity:
          data.averageHealthScore >= 80
            ? "info"
            : data.averageHealthScore >= 50
              ? "warning"
              : "critical",
      }),
    );

    return insights;
  }
}
