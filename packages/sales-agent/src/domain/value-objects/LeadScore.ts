import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

export const MIN_LEAD_SCORE = 0;
export const MAX_LEAD_SCORE = 100;

/**
 * A lead's cumulative qualification score, always clamped to `[0, 100]` (spec's "Business
 * correctness" pin: "score never goes below 0" — and, symmetrically, never above 100). `apply`
 * is the only way to move a score: it takes a raw delta (positive or negative, see `ScoreDelta`)
 * and returns a NEW, clamped `LeadScore` — never mutates `this`.
 */
export class LeadScore {
  private constructor(private readonly value: number) {}

  static zero(): LeadScore {
    return new LeadScore(0);
  }

  static create(raw: number): Result<LeadScore, ValidationError> {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return err(
        new ValidationError(`LeadScore must be a finite number, received: ${String(raw)}`),
      );
    }
    return ok(new LeadScore(clamp(raw)));
  }

  toNumber(): number {
    return this.value;
  }

  /** Applies a raw delta (positive or negative), clamped to `[0, 100]`. Returns a NEW `LeadScore`. */
  apply(delta: number): LeadScore {
    return new LeadScore(clamp(this.value + delta));
  }

  isAtLeast(threshold: number): boolean {
    return this.value >= threshold;
  }

  equals(other: LeadScore): boolean {
    return this.value === other.value;
  }
}

function clamp(value: number): number {
  return Math.min(MAX_LEAD_SCORE, Math.max(MIN_LEAD_SCORE, value));
}
