import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A sales human's live availability. `ON` = actively taking leads, `BUSY` = temporarily unavailable (still counted as staffed), `OFF` = off shift. */
export enum SalesStatus {
  ON = "ON",
  BUSY = "BUSY",
  OFF = "OFF",
}

/** Parses a raw (possibly externally-sourced, case-insensitive) status string into `SalesStatus`. */
export function parseSalesStatus(raw: string): Result<SalesStatus, ValidationError> {
  if (typeof raw !== "string") {
    return err(new ValidationError(`status must be a string, received: ${JSON.stringify(raw)}`));
  }
  const normalized = raw.trim().toUpperCase();
  if (
    normalized === SalesStatus.ON ||
    normalized === SalesStatus.BUSY ||
    normalized === SalesStatus.OFF
  ) {
    return ok(normalized);
  }
  return err(new ValidationError(`status must be one of "ON", "BUSY", "OFF", received: "${raw}"`));
}
