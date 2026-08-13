import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const MIN_SECONDS = 1;
const MAX_SECONDS = 8;

/**
 * The `duration`/`additionalSeconds` parameter sent to the video-extend endpoint
 * (`POST /api/v1/veo/extend`) — a positive integer from 1 to 8 inclusive, per the Long Video Flow
 * algorithm's own `min(remaining, 8)` computation. Deliberately separate from `DurationSeconds`
 * (5|8-only, per-clip generate duration) — see that file's docstring and design resolution #3 in
 * docs/AAOS-CREATIVE-CONNECTOR-REPORT.md for why reusing `DurationSeconds` here would make the
 * spec's own pinned 7s/6s extend examples impossible to validate.
 */
export class ExtendDurationSeconds {
  private constructor(private readonly value: number) {}

  static create(raw: number): Result<ExtendDurationSeconds, ValidationError> {
    if (
      typeof raw !== "number" ||
      !Number.isInteger(raw) ||
      raw < MIN_SECONDS ||
      raw > MAX_SECONDS
    ) {
      return err(
        new ValidationError(
          `ExtendDurationSeconds must be an integer from ${MIN_SECONDS} to ${MAX_SECONDS}, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new ExtendDurationSeconds(raw));
  }

  get seconds(): number {
    return this.value;
  }

  equals(other: ExtendDurationSeconds): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
