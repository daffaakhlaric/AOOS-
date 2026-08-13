import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

const VALID_DURATIONS: ReadonlySet<number> = new Set([5, 8]);

/**
 * A single Veo clip's duration in seconds — Kie AI's Veo 3.1 model only ever produces a 5s or 8s
 * clip per generate call, per the spec's folder-listing annotation ("5 | 8 per clip").
 *
 * Design resolution #3 (documented in docs/AAOS-CREATIVE-CONNECTOR-REPORT.md): this VO is NOT used
 * to validate the video-*extend* endpoint's `duration`/`additionalSeconds` parameter. The spec's
 * own pinned Long Video Flow arithmetic requires extend calls of 7s and 6s ("15s =
 * generate(8s) + extend(7s)", "30s = generate(8s) + extend(8s) + extend(8s) + extend(6s)"), neither
 * of which is a valid `DurationSeconds` (5|8-only) value — using this VO there would make the
 * long-video flow's own pinned test cases impossible to satisfy. `ExtendVideo`/`GenerateLongVideo`
 * instead validate the extend duration through the separate, more permissive
 * `ExtendDurationSeconds` value object (1-8 inclusive).
 *
 * Consequently, `DurationSeconds` currently has no real call site in this package's Kie AI request
 * payloads (the Veo generate JSON body shown in the spec's Part 2 carries no duration field at
 * all) — it exists as the documented scaffolding value object the spec's folder listing calls for,
 * ready for a future Kie AI payload field that does need a strict 5-or-8 constraint.
 */
export class DurationSeconds {
  private constructor(private readonly value: 5 | 8) {}

  static create(raw: number): Result<DurationSeconds, ValidationError> {
    if (typeof raw !== "number" || !VALID_DURATIONS.has(raw)) {
      return err(
        new ValidationError(`DurationSeconds must be 5 or 8, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new DurationSeconds(raw as 5 | 8));
  }

  get seconds(): 5 | 8 {
    return this.value;
  }

  equals(other: DurationSeconds): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
