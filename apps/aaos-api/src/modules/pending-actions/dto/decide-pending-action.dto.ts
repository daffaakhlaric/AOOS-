import { z } from "zod";

/**
 * `POST /api/v1/pending-actions/:id/approve` / `.../reject` bodies (AAOS-OPERATING-MODE-APPROVAL-
 * GATE) — same optional `decidedBy`/notes shape `DecideProposalBodySchema` already establishes for
 * the exact same real "AI recommendation needs a human decision" pattern. `decidedBy` is optional
 * for the same real reason `UpdateModeBodySchema`'s own doc gives: this app has no established
 * per-request authenticated-user-id header/decorator yet — the dashboard's proxy route forwards the
 * caller's real session email when present; omitting it just leaves the row's `decided_by` `null`
 * rather than a fabricated value.
 */
export const DecidePendingActionBodySchema = z.object({
  decidedBy: z.string().min(1).optional(),
  decisionNotes: z.string().min(1).optional(),
});
export type DecidePendingActionBodyDto = z.infer<typeof DecidePendingActionBodySchema>;
