import type { IClock } from "../contracts/i-clock.js";
import { KnowledgeHealthReport } from "../entities/knowledge-health-report.js";
import { generateId } from "../utils/id-generator.js";
import type { KnowledgeHealthScore } from "../value-objects/knowledge-health-score.js";

/** Factory-pattern class constructing `KnowledgeHealthReport` aggregates with sensible defaults. */
export class KnowledgeHealthReportFactory {
  constructor(private readonly clock: IClock) {}

  create(
    overallScore: KnowledgeHealthScore,
    itemScores: readonly { readonly itemId: string; readonly score: KnowledgeHealthScore }[],
  ): KnowledgeHealthReport {
    return new KnowledgeHealthReport({
      id: generateId("health-report"),
      generatedAt: this.clock.now(),
      overallScore,
      itemScores,
    });
  }
}
