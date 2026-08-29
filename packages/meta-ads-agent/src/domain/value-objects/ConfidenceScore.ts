import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A 0-100 confidence score. Design/judgment call (spec does not pin an exact formula, only the
 * pinned test outcome "100% data coverage → confidence > 80"):
 *
 *   confidence = round(40 + 60 * coverageFraction)
 *
 * where `coverageFraction` is the fraction of ads in the analyzed `AdAccount` whose `rphD3` (or
 * `rphChat`, per caller) is *defined* (non-null — see `@aos/meta-ads-connector`'s `Rph`, which is
 * `null` for ads with a zero denominator). Rationale: a floor of 40 means Samantha is never
 * reported as having *zero* confidence even with no usable data (there is always some baseline
 * rule-based confidence from the deterministic decision engine itself), while full (100%) data
 * coverage yields `round(40 + 60) = 100`, safely `> 80`. Partial coverage degrades linearly and
 * predictably. This is the ONE place the formula lives — `CampaignHealthAnalyzer` and
 * `DecisionEngineService` both call `ConfidenceScore.fromCoverage`.
 */
export class ConfidenceScore {
  private constructor(private readonly score: number) {}

  static create(score: number): Result<ConfidenceScore, ValidationError> {
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return err(
        new ValidationError(`ConfidenceScore must be within 0-100, received: ${String(score)}`),
      );
    }
    return ok(new ConfidenceScore(Math.round(score)));
  }

  /** `coverageFraction` must be within [0, 1] — the fraction of ads with defined (non-null) performance data. */
  static fromCoverage(coverageFraction: number): Result<ConfidenceScore, ValidationError> {
    if (!Number.isFinite(coverageFraction) || coverageFraction < 0 || coverageFraction > 1) {
      return err(
        new ValidationError(
          `ConfidenceScore.fromCoverage coverageFraction must be within 0-1, received: ${String(coverageFraction)}`,
        ),
      );
    }
    return ConfidenceScore.create(40 + 60 * coverageFraction);
  }

  toNumber(): number {
    return this.score;
  }

  isAbove(threshold: number): boolean {
    return this.score > threshold;
  }

  equals(other: ConfidenceScore): boolean {
    return this.score === other.score;
  }
}
