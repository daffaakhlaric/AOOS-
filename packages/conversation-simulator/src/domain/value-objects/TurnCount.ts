/** A non-negative turn counter (spec "domain/value-objects/TurnCount.ts"). Immutable — `increment()` returns a new instance. */
export class TurnCount {
  private constructor(private readonly raw: number) {}

  static zero(): TurnCount {
    return new TurnCount(0);
  }

  static of(value: number): TurnCount {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`TurnCount must be a non-negative integer, got ${value}`);
    }
    return new TurnCount(value);
  }

  increment(): TurnCount {
    return new TurnCount(this.raw + 1);
  }

  toNumber(): number {
    return this.raw;
  }

  isAtLeast(threshold: number): boolean {
    return this.raw >= threshold;
  }

  equals(other: TurnCount): boolean {
    return this.raw === other.raw;
  }
}
