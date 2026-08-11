import type { DimensionWeights } from "../../config/AiJudgeConfig.js";

/** The 6 per-dimension `DimensionScoreValue.value` numbers (each already clamped to `[0, 10]`) an `OverallScore` is computed from. */
export interface DimensionScoreInputs {
  readonly naturalLanguage: number;
  readonly qualification: number;
  readonly objectionHandling: number;
  readonly closingAttempt: number;
  readonly handoffQuality: number;
  readonly responseLength: number;
}

/**
 * The weighted overall score, `[0, 100]` (spec "Grading" — weighted 0-10 average x10). Immutable
 * value object.
 */
export class OverallScore {
  static readonly MIN = 0;
  static readonly MAX = 100;

  private constructor(private readonly raw: number) {}

  /**
   * `overallScore = (nl*w_nl + qual*w_qual + obj*w_obj + close*w_close + handoff*w_handoff +
   * length*w_length) * 10`, clamped to `[0, 100]` (spec's pinned "Business correctness" example:
   * nl=8, qual=7, obj=10, close=9, handoff=10, length=9 -> 8.55 -> 85.5).
   */
  static fromDimensions(dimensions: DimensionScoreInputs, weights: DimensionWeights): OverallScore {
    const weighted =
      dimensions.naturalLanguage * weights.naturalLanguage +
      dimensions.qualification * weights.qualification +
      dimensions.objectionHandling * weights.objectionHandling +
      dimensions.closingAttempt * weights.closingAttempt +
      dimensions.handoffQuality * weights.handoffQuality +
      dimensions.responseLength * weights.responseLength;
    const scaled = weighted * 10;
    const clamped = Math.min(OverallScore.MAX, Math.max(OverallScore.MIN, scaled));
    return new OverallScore(clamped);
  }

  static of(raw: number): OverallScore {
    return new OverallScore(Math.min(OverallScore.MAX, Math.max(OverallScore.MIN, raw)));
  }

  get value(): number {
    return this.raw;
  }

  toNumber(): number {
    return this.raw;
  }
}
