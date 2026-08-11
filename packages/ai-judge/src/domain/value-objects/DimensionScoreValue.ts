/**
 * A single dimension's score, always clamped to the spec's `[0, 10]` range (spec: dimension 1
 * "Max: 10, Min: 0" — applied uniformly to all six dimensions, per the task's explicit
 * instruction, since `DimensionScoreValue` is defined generically as "0-10 per dimension").
 * Immutable value object.
 */
export class DimensionScoreValue {
  static readonly MIN = 0;
  static readonly MAX = 10;

  private constructor(private readonly raw: number) {}

  /** Clamps `raw` into `[0, 10]` — the only way to construct one, so an out-of-range score can never escape a scorer. */
  static of(raw: number): DimensionScoreValue {
    const clamped = Math.min(DimensionScoreValue.MAX, Math.max(DimensionScoreValue.MIN, raw));
    return new DimensionScoreValue(clamped);
  }

  get value(): number {
    return this.raw;
  }

  toNumber(): number {
    return this.raw;
  }
}
