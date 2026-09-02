import { z } from "zod";

/**
 * `PATCH /api/v1/settings/operating-mode` body (AAOS-OPERATING-MODE-APPROVAL-GATE) — the new "Mode
 * Operasi AI" card's confirm-dialog action, mirroring `UpdateModeBodySchema`'s exact real shape.
 * `changedBy` is optional for the same real reason that DTO's own doc gives: this app has no
 * established per-request authenticated-user-id header/decorator yet — `apps/aaos-dashboard`'s
 * proxy route forwards the caller's real session email when present; omitting it just means the
 * audit row's `operating_mode_changed_by` stays `null` rather than a fabricated value.
 */
export const UpdateOperatingModeBodySchema = z.object({
  operatingMode: z.enum(["FULL_CONTROL", "APPROVAL"]),
  changedBy: z.string().min(1).optional(),
});

export type UpdateOperatingModeBodyDto = z.infer<typeof UpdateOperatingModeBodySchema>;
