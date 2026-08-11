import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** The one-letter prefix that scopes a StableId's sequence: campaigns (A), ad sets (B), ads (C). */
export type StableIdPrefix = "A" | "B" | "C";

const VALID_PREFIXES: ReadonlySet<StableIdPrefix> = new Set(["A", "B", "C"]);

/**
 * A stable, human-readable identifier assigned per sync snapshot — "#A001", "#B014", "#C102" —
 * per the spec's Stable ID Assignment rule (spend-DESC within scope, zero-padded to 3 digits).
 */
export class StableId {
  private constructor(
    private readonly prefix: StableIdPrefix,
    private readonly sequence: number,
  ) {}

  static create(prefix: StableIdPrefix, sequence: number): Result<StableId, ValidationError> {
    if (!VALID_PREFIXES.has(prefix)) {
      return err(
        new ValidationError(`StableId prefix must be one of A, B, C — received: ${String(prefix)}`),
      );
    }
    if (!Number.isInteger(sequence) || sequence < 1) {
      return err(
        new ValidationError(
          `StableId sequence must be a positive integer — received: ${String(sequence)}`,
        ),
      );
    }
    if (sequence > 999) {
      return err(
        new ValidationError(
          `StableId sequence must not exceed 999 (3-digit format) — received: ${sequence}`,
        ),
      );
    }
    return ok(new StableId(prefix, sequence));
  }

  toString(): string {
    return `#${this.prefix}${String(this.sequence).padStart(3, "0")}`;
  }

  equals(other: StableId): boolean {
    return this.prefix === other.prefix && this.sequence === other.sequence;
  }
}
