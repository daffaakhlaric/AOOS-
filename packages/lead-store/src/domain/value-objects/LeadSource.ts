import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** How a lead first reached AAOS (spec schema `leads.lead_source`). */
export enum LeadSource {
  CTWA = "CTWA",
  FORM = "FORM",
  ORGANIC = "ORGANIC",
}

/** Parses a raw (possibly externally-sourced, case-insensitive) source string into `LeadSource`. */
export function parseLeadSource(raw: string): Result<LeadSource, ValidationError> {
  if (typeof raw !== "string") {
    return err(
      new ValidationError(`leadSource must be a string, received: ${JSON.stringify(raw)}`),
    );
  }
  const normalized = raw.trim().toUpperCase();
  if (
    normalized === LeadSource.CTWA ||
    normalized === LeadSource.FORM ||
    normalized === LeadSource.ORGANIC
  ) {
    return ok(normalized);
  }
  return err(
    new ValidationError(`leadSource must be one of "CTWA", "FORM", "ORGANIC", received: "${raw}"`),
  );
}
