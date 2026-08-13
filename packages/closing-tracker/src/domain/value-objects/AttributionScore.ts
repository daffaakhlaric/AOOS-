import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Confidence of a campaign attribution, `0`-`100` inclusive (spec: "Attribution Engine"). */
export class AttributionScore {
  private constructor(private readonly score: number) {}

  /** Method 1 — Direct: `lead.campaign_id` was set on the closing itself. */
  static readonly DIRECT = 100;
  /** Method 2 — Time-based: no `campaign_id`, attributed to the highest-spend campaign active for that branch on that day. */
  static readonly TIME_BASED = 70;
  /** Method 3 — Branch-based: only branch known, attributed proportionally across active campaigns for that branch. */
  static readonly BRANCH_BASED = 40;

  static create(score: number): Result<AttributionScore, ValidationError> {
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return err(
        new ValidationError(
          `AttributionScore must be a finite number between 0 and 100, received: ${score}`,
        ),
      );
    }
    return ok(new AttributionScore(score));
  }

  static direct(): AttributionScore {
    return new AttributionScore(AttributionScore.DIRECT);
  }

  static timeBased(): AttributionScore {
    return new AttributionScore(AttributionScore.TIME_BASED);
  }

  static branchBased(): AttributionScore {
    return new AttributionScore(AttributionScore.BRANCH_BASED);
  }

  get value(): number {
    return this.score;
  }
}
