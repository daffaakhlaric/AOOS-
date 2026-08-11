import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** Why a lead's score changed (spec schema `scoring_events.reason`) — mirrors the qualification signals `@aos/sales-agent`'s Jessy already tracks (budget/unit/area/payment/timeline/name), plus two negative signals (no reply, not serious). */
export enum ScoreReason {
  BUDGET = "BUDGET",
  UNIT = "UNIT",
  AREA = "AREA",
  PAYMENT = "PAYMENT",
  TIMELINE = "TIMELINE",
  NAME = "NAME",
  NO_REPLY = "NO_REPLY",
  NOT_SERIOUS = "NOT_SERIOUS",
}

/** Parses a raw (possibly externally-sourced, case-insensitive) reason string into `ScoreReason`. */
export function parseScoreReason(raw: string): Result<ScoreReason, ValidationError> {
  if (typeof raw !== "string") {
    return err(new ValidationError(`reason must be a string, received: ${JSON.stringify(raw)}`));
  }
  const normalized = raw.trim().toUpperCase();
  const values = Object.values(ScoreReason) as string[];
  if (values.includes(normalized)) {
    return ok(normalized as ScoreReason);
  }
  return err(new ValidationError(`reason must be one of ${values.join(", ")}, received: "${raw}"`));
}
