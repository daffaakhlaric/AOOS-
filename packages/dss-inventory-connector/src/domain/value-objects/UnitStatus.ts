import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A unit's availability status. `SOLD` is terminal — see `UnitSold` event, consumed by Samantha to auto-pause campaigns. */
export enum UnitStatus {
  AVAILABLE = "AVAILABLE",
  RESERVED = "RESERVED",
  SOLD = "SOLD",
}

/** Parses a raw (possibly externally-sourced, case-insensitive) status string into `UnitStatus`. */
export function parseUnitStatus(raw: string): Result<UnitStatus, ValidationError> {
  if (typeof raw !== "string") {
    return err(new ValidationError(`status must be a string, received: ${JSON.stringify(raw)}`));
  }
  const normalized = raw.trim().toUpperCase();
  if (
    normalized === UnitStatus.AVAILABLE ||
    normalized === UnitStatus.RESERVED ||
    normalized === UnitStatus.SOLD
  ) {
    return ok(normalized);
  }
  return err(
    new ValidationError(
      `status must be one of "AVAILABLE", "RESERVED", "SOLD", received: "${raw}"`,
    ),
  );
}
