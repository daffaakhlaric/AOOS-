/**
 * "Rupiah per unit" — spend divided by a count (Rp/chat, Rp/D3, Rp/lead). Division by zero is a
 * normal, expected state (e.g. an ad with 0 spend or 0 D3s) — not a validation error — so `Rph`
 * never throws and never returns `Result`; it represents "no rate available" as `value === null`
 * rather than leaking `Infinity`/`NaN` into domain state (spec: "rphD3 = undefined/null safe").
 */
export class Rph {
  private constructor(readonly value: number | null) {}

  static calculate(spendAmount: number, count: number): Rph {
    if (!Number.isFinite(spendAmount) || !Number.isFinite(count) || count <= 0) {
      return new Rph(null);
    }
    const result = spendAmount / count;
    return new Rph(Number.isFinite(result) ? result : null);
  }

  static undefined_(): Rph {
    return new Rph(null);
  }

  isDefined(): boolean {
    return this.value !== null;
  }

  /** Whether this rate is at or below the given IDR threshold. `false` when undefined (no rate to compare). */
  isAtMost(thresholdIDR: number): boolean {
    return this.value !== null && this.value <= thresholdIDR;
  }

  /** Whether this rate exceeds the given IDR threshold. `false` when undefined (no rate to compare). */
  isAbove(thresholdIDR: number): boolean {
    return this.value !== null && this.value > thresholdIDR;
  }

  isWithin(minIDR: number, maxIDR: number): boolean {
    return this.value !== null && this.value >= minIDR && this.value <= maxIDR;
  }

  equals(other: Rph): boolean {
    return this.value === other.value;
  }
}
