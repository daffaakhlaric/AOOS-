import type { ThresholdBand } from "../types/common.js";
import { evaluateThreshold } from "../utils/scoring-math.js";
import { KnowledgeScore } from "../value-objects/knowledge-score.js";

/** Factory-pattern class constructing `KnowledgeScore` value objects from a raw value + bands. */
export class KnowledgeScoreFactory {
  create(name: string, value: number, bands: readonly ThresholdBand[]): KnowledgeScore {
    return new KnowledgeScore({ name, value, band: evaluateThreshold(value, bands) });
  }
}
