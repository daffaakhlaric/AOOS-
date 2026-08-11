import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A vehicle's transmission type. */
export enum UnitTransmission {
  AT = "AT",
  MT = "MT",
}

/** Parses a raw (possibly externally-sourced, case-insensitive) transmission string into `UnitTransmission`. */
export function parseUnitTransmission(raw: string): Result<UnitTransmission, ValidationError> {
  if (typeof raw !== "string") {
    return err(
      new ValidationError(`transmission must be a string, received: ${JSON.stringify(raw)}`),
    );
  }
  const normalized = raw.trim().toUpperCase();
  if (normalized === UnitTransmission.AT || normalized === UnitTransmission.MT) {
    return ok(normalized);
  }
  return err(new ValidationError(`transmission must be "AT" or "MT", received: "${raw}"`));
}
