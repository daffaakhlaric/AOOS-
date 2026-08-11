import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** What kind of closing event occurred (spec schema `closings.closing_type`). */
export enum ClosingType {
  TEST_DRIVE = "TEST_DRIVE",
  SPK = "SPK",
  CANCELLED = "CANCELLED",
}

/** Parses a raw (possibly externally-sourced, case-insensitive) closing type string into `ClosingType`. */
export function parseClosingType(raw: string): Result<ClosingType, ValidationError> {
  if (typeof raw !== "string") {
    return err(
      new ValidationError(`closingType must be a string, received: ${JSON.stringify(raw)}`),
    );
  }
  const normalized = raw.trim().toUpperCase();
  if (
    normalized === ClosingType.TEST_DRIVE ||
    normalized === ClosingType.SPK ||
    normalized === ClosingType.CANCELLED
  ) {
    return ok(normalized);
  }
  return err(
    new ValidationError(
      `closingType must be one of "TEST_DRIVE", "SPK", "CANCELLED", received: "${raw}"`,
    ),
  );
}
