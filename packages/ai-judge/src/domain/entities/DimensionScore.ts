import type { DimensionName } from "../value-objects/DimensionName.js";
import type { DimensionScoreValue } from "../value-objects/DimensionScoreValue.js";

/** One scoring rule that fired (or explicitly did not) while a scorer evaluated a dimension — the audit trail behind every `Feedback`/highlight string. */
export interface AppliedRule {
  readonly rule: string;
  readonly points: number;
  readonly note: string;
}

/** The score for one of the 6 dimensions (spec "domain/entities/DimensionScore.ts"), 0-10, plus the full rule breakdown that produced it. */
export interface DimensionScore {
  readonly dimension: DimensionName;
  readonly score: DimensionScoreValue;
  readonly appliedRules: ReadonlyArray<AppliedRule>;
}
