import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A 0-100 progress percentage (clamped-at-construction validation, never negative or > 100). */
export class ProgressPercentage {
  private constructor(private readonly value: number) {}

  static create(value: number): Result<ProgressPercentage, ValidationError> {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return err(
        new ValidationError(
          `ProgressPercentage must be a finite number, received: ${String(value)}`,
        ),
      );
    }
    if (value < 0 || value > 100) {
      return err(
        new ValidationError(`ProgressPercentage must be within 0-100, received: ${value}`),
      );
    }
    return ok(new ProgressPercentage(value));
  }

  /** Computes `(currentHotLeads / targetHotLeads) * 100`, clamped to [0, 100]. `targetHotLeads <= 0` is unreachable in practice — `TargetLeads` never allows it — but is guarded defensively here anyway. */
  static fromCounts(currentHotLeads: number, targetHotLeads: number): ProgressPercentage {
    /* v8 ignore next 3 */
    if (targetHotLeads <= 0) {
      return new ProgressPercentage(0);
    }
    const raw = (currentHotLeads / targetHotLeads) * 100;
    const clamped = Math.min(100, Math.max(0, raw));
    return new ProgressPercentage(clamped);
  }

  toNumber(): number {
    return this.value;
  }

  isComplete(): boolean {
    return this.value >= 100;
  }

  equals(other: ProgressPercentage): boolean {
    return this.value === other.value;
  }
}
