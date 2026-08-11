import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * A lead's workflow stage (spec schema `leads.status`). Distinct from `temperature`
 * (always `COLD | WARM | HOT`, reflecting the latest score bucket) — `status` additionally
 * tracks the two terminal-ish workflow stages `ASSIGNED` and `CLOSED` that a score bucket alone
 * cannot express. See `LeadStatusTransition.ts` for the state machine enforcing which
 * transitions are legal and via which use case.
 */
export enum LeadStatus {
  NEW = "NEW",
  COLD = "COLD",
  WARM = "WARM",
  HOT = "HOT",
  ASSIGNED = "ASSIGNED",
  CLOSED = "CLOSED",
}

/** The 3 `LeadStatus` members that also double as a temperature bucket. */
export type TemperatureStatus = LeadStatus.COLD | LeadStatus.WARM | LeadStatus.HOT;

const TEMPERATURE_STATUSES: ReadonlySet<LeadStatus> = new Set([
  LeadStatus.COLD,
  LeadStatus.WARM,
  LeadStatus.HOT,
]);

/** True for `NEW | COLD | WARM | HOT` — the "not yet assigned or closed" workflow stages RecordScoreEvent is allowed to overwrite (design resolution #2). */
export function isPreAssignmentStatus(status: LeadStatus): boolean {
  return (
    status === LeadStatus.NEW ||
    status === LeadStatus.COLD ||
    status === LeadStatus.WARM ||
    status === LeadStatus.HOT
  );
}

export function isTemperatureStatus(status: LeadStatus): status is TemperatureStatus {
  return TEMPERATURE_STATUSES.has(status);
}

/** Parses a raw (possibly externally-sourced, case-insensitive) status string into `LeadStatus`. */
export function parseLeadStatus(raw: string): Result<LeadStatus, ValidationError> {
  if (typeof raw !== "string") {
    return err(new ValidationError(`status must be a string, received: ${JSON.stringify(raw)}`));
  }
  const normalized = raw.trim().toUpperCase();
  const values = Object.values(LeadStatus) as string[];
  if (values.includes(normalized)) {
    return ok(normalized as LeadStatus);
  }
  return err(new ValidationError(`status must be one of ${values.join(", ")}, received: "${raw}"`));
}

/** Classifies a numeric score into a `TemperatureStatus`. Pinned boundary (spec's "Business correctness"): `score=64` → WARM, `score=65` → HOT. Matches `@aos/sales-agent`'s `classifyTemperature` defaults (warm=31, hot=65) — same domain concept, reused for compatibility. */
export function classifyTemperature(
  score: number,
  warmThreshold = 31,
  hotThreshold = 65,
): TemperatureStatus {
  if (score >= hotThreshold) {
    return LeadStatus.HOT;
  }
  if (score >= warmThreshold) {
    return LeadStatus.WARM;
  }
  return LeadStatus.COLD;
}
