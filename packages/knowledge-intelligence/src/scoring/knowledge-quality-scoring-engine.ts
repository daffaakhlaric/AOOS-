import type { WeightedSignal } from "../types/common.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import type { KnowledgeScore } from "../value-objects/knowledge-score.js";

import { KnowledgeScoreComputer } from "./knowledge-score-computer.js";

const QUALITY_BANDS = [
  { label: "excellent", min: 90 },
  { label: "good", min: 70 },
  { label: "fair", min: 50 },
  { label: "poor", min: 0 },
];

/**
 * Real weighted-sum Quality score from caller-supplied structural completeness signals:
 * completeness ratio (required fields present), a structural-richness signal (has summary /
 * examples / owner), and a content-length adequacy signal (not too short).
 */
export class KnowledgeQualityScoringEngine {
  constructor(private readonly computer: KnowledgeScoreComputer = new KnowledgeScoreComputer()) {}

  score(item: KnowledgeItemSnapshot): KnowledgeScore {
    const completeness =
      item.requiredFieldsTotal > 0
        ? this.computer.normalize(item.requiredFieldsPresent, 0, item.requiredFieldsTotal)
        : 100;

    const structuralPoints =
      (item.hasSummary ? 1 : 0) + (item.hasExamples ? 1 : 0) + (item.hasOwner ? 1 : 0);
    const structuralRichness = this.computer.normalize(structuralPoints, 0, 3);

    const lengthAdequacy = this.computer.normalize(Math.min(item.contentLength, 500), 0, 500);

    const signals: readonly WeightedSignal[] = [
      { name: "completeness", value: completeness, weight: 0.5 },
      { name: "structuralRichness", value: structuralRichness, weight: 0.3 },
      { name: "lengthAdequacy", value: lengthAdequacy, weight: 0.2 },
    ];

    return this.computer.aggregate("quality", signals, QUALITY_BANDS);
  }
}
