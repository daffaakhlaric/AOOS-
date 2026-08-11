import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** How a branch assigns incoming leads to its sales team. See `intelligence/` for the strategy implementing each mode. */
export enum AssignmentMode {
  SMART_ASSIGN = "SMART_ASSIGN",
  ROUND_ROBIN = "ROUND_ROBIN",
  MANUAL = "MANUAL",
}

/** Parses a raw (possibly externally-sourced, case-insensitive) mode string into `AssignmentMode`. */
export function parseAssignmentMode(raw: string): Result<AssignmentMode, ValidationError> {
  if (typeof raw !== "string") {
    return err(new ValidationError(`mode must be a string, received: ${JSON.stringify(raw)}`));
  }
  const normalized = raw.trim().toUpperCase();
  if (
    normalized === AssignmentMode.SMART_ASSIGN ||
    normalized === AssignmentMode.ROUND_ROBIN ||
    normalized === AssignmentMode.MANUAL
  ) {
    return ok(normalized);
  }
  return err(
    new ValidationError(
      `mode must be one of "SMART_ASSIGN", "ROUND_ROBIN", "MANUAL", received: "${raw}"`,
    ),
  );
}
