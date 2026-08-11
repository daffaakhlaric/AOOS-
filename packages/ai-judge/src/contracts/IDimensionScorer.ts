import type { SimulationResult } from "@aos/conversation-simulator";

import type { AiJudgeConfig } from "../config/AiJudgeConfig.js";
import type { DimensionScore } from "../domain/entities/DimensionScore.js";

/**
 * Strategy Pattern contract — one implementation per scoring dimension (spec "6 Scoring
 * Dimensions"). Purely deterministic: no I/O, no `Math.random()`, no LLM calls. `config` carries
 * the golden/approve thresholds a scorer may need (e.g. `ObjectionHandlingScorer`'s "N/A" default
 * score), even though most scorers only need `simulationResult`.
 */
export interface IDimensionScorer {
  score(simulationResult: SimulationResult, config: AiJudgeConfig): DimensionScore;
}
