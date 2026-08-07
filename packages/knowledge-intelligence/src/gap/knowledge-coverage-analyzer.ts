import type { TaxonomyCoverageEntry } from "../types/knowledge-item.js";
import { evaluateThreshold, normalizeToScore } from "../utils/scoring-math.js";
import { KnowledgeScore } from "../value-objects/knowledge-score.js";

const COVERAGE_BANDS = [
  { label: "comprehensive", min: 90 },
  { label: "adequate", min: 60 },
  { label: "sparse", min: 0 },
];

/**
 * Real set-ratio Coverage score: `coveredTopics / totalTopics * 100` over a caller-supplied
 * taxonomy coverage table. No graph or embedding logic — plain counting over structured input.
 */
export class KnowledgeCoverageAnalyzer {
  score(taxonomy: readonly TaxonomyCoverageEntry[]): KnowledgeScore {
    if (taxonomy.length === 0) {
      return new KnowledgeScore({
        name: "coverage",
        value: 100,
        band: evaluateThreshold(100, COVERAGE_BANDS),
      });
    }
    const covered = taxonomy.filter((entry) => entry.covered).length;
    const value = normalizeToScore(covered, 0, taxonomy.length);
    return new KnowledgeScore({
      name: "coverage",
      value,
      band: evaluateThreshold(value, COVERAGE_BANDS),
    });
  }

  uncoveredTopics(taxonomy: readonly TaxonomyCoverageEntry[]): readonly TaxonomyCoverageEntry[] {
    return taxonomy.filter((entry) => !entry.covered);
  }

  underRepresentedTopics(
    taxonomy: readonly TaxonomyCoverageEntry[],
    minItemCount: number,
  ): readonly TaxonomyCoverageEntry[] {
    return taxonomy.filter((entry) => entry.covered && entry.itemCount < minItemCount);
  }
}
