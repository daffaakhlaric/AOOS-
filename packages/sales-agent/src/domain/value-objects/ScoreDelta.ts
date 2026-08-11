/** The criteria (positive + negative) `ScoreCalculator` can detect — the spec's `SCORING_RULES` criterion names. */
export type ScoringCriterion =
  "BUDGET" | "UNIT" | "AREA" | "PAYMENT" | "TIMELINE" | "NAME" | "NO_REPLY" | "NOT_SERIOUS";

/** One applied scoring event: which criterion fired, and by how much (signed). Immutable value object. */
export class ScoreDelta {
  private constructor(
    private readonly criterionValue: ScoringCriterion,
    private readonly amountValue: number,
  ) {}

  static of(criterion: ScoringCriterion, amount: number): ScoreDelta {
    return new ScoreDelta(criterion, amount);
  }

  get criterion(): ScoringCriterion {
    return this.criterionValue;
  }

  get amount(): number {
    return this.amountValue;
  }

  get isPositive(): boolean {
    return this.amountValue > 0;
  }
}
