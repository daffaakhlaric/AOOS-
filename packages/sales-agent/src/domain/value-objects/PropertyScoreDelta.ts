/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 (spec Part 6's `PROPERTY_QUALIFICATION`) — the
 * PROPERTY vertical's sibling to `ScoringCriterion`. A separate type, not an extension of it:
 * `ScoringCriterion`'s `UNIT`/`NAME`/`NO_REPLY`/`NOT_SERIOUS` members are automotive-specific
 * (car unit interest, name capture, timeout/hesitation penalties with no PROPERTY equivalent
 * defined by the spec — Part 6 only names 6 POSITIVE dimensions), and the point values differ
 * (25/25/25/25/10/10 automotive vs 20/15/20/15/20/10 PROPERTY) — reusing the same union would force
 * every automotive `Record<ScoringCriterion, …>` to grow PROPERTY cases it has no real data for.
 */
export type PropertyScoringCriterion =
  "BUDGET" | "PROPERTY_TYPE" | "AREA" | "PAYMENT" | "TIMELINE" | "BEDROOMS";

/** One applied PROPERTY scoring event — the sibling to `ScoreDelta`, same immutable value-object shape. */
export class PropertyScoreDelta {
  private constructor(
    private readonly criterionValue: PropertyScoringCriterion,
    private readonly amountValue: number,
  ) {}

  static of(criterion: PropertyScoringCriterion, amount: number): PropertyScoreDelta {
    return new PropertyScoreDelta(criterion, amount);
  }

  get criterion(): PropertyScoringCriterion {
    return this.criterionValue;
  }

  get amount(): number {
    return this.amountValue;
  }

  get isPositive(): boolean {
    return this.amountValue > 0;
  }
}
