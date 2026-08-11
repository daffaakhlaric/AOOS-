import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * DSS Motor's sellable vehicle units. The spec's domain-model comment ("'Xpander' | 'Brio' |
 * 'Avanza' | etc") signals a bounded-but-extensible catalog — modeled as a validated string
 * union (not a Meta-sourced enum like `Branch`) so a future unit can be added in one place
 * without touching every call site that pattern-matches on it.
 */
export const FOCUS_UNITS = [
  "Xpander",
  "Brio",
  "Avanza",
  "Innova",
  "Fortuner",
  "BRV",
  "HRV",
  "Civic",
  "Mobilio",
  "Yaris",
] as const;

export type FocusUnitName = (typeof FOCUS_UNITS)[number];

const FOCUS_UNIT_SET: ReadonlySet<string> = new Set(FOCUS_UNITS);

/** A validated Value Object wrapping one of DSS Motor's focus vehicle units. */
export class FocusUnit {
  private constructor(private readonly name: FocusUnitName) {}

  static create(raw: string): Result<FocusUnit, ValidationError> {
    if (typeof raw !== "string" || !FOCUS_UNIT_SET.has(raw)) {
      return err(
        new ValidationError(
          `FocusUnit must be one of ${FOCUS_UNITS.join(", ")}, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new FocusUnit(raw as FocusUnitName));
  }

  toString(): FocusUnitName {
    return this.name;
  }

  equals(other: FocusUnit): boolean {
    return this.name === other.name;
  }
}
