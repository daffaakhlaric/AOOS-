import { z } from "zod";

/**
 * `PATCH /api/v1/settings/mode` body — the new "Mode Operasi" card's confirm-dialog action
 * (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A point 4). `changedBy` is optional (this app has no
 * established per-request authenticated-user-id header/decorator yet — see
 * `common/tenant-context.ts`'s `@TenantId()` for the only real per-request identity resolved
 * today) — `apps/aaos-dashboard`'s proxy route forwards the caller's real session email when
 * present; omitting it just means the audit row's `mode_changed_by` stays `null` rather than a
 * fabricated value.
 */
export const UpdateModeBodySchema = z.object({
  mode: z.enum(["DEV", "LIVE"]),
  changedBy: z.string().min(1).optional(),
});

export type UpdateModeBodyDto = z.infer<typeof UpdateModeBodySchema>;
