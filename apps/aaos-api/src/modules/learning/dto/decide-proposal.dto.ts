import { z } from "zod";

/**
 * `POST /api/v1/learning/proposals/:id/approve` / `.../reject` bodies (AAOS Self-Learning AI,
 * Phase C — the human-approval gate). Same optional `decidedBy`/notes shape
 * `ReviewSimulationBodySchema` already establishes for the exact same real "AI recommendation
 * needs a human decision" pattern (design doc Finding #5) — `decisionNotes` names the field to
 * match `learning_proposals.decision_notes`'s own column name directly, since this table (unlike
 * `simulations`) already carries that literal name.
 *
 * `decidedBy` is optional for the same real reason `UpdateModeBodySchema`'s own doc gives: this
 * app has no established per-request authenticated-user-id header/decorator yet — the dashboard's
 * proxy route forwards the caller's real session email when present; omitting it just leaves the
 * row's `decided_by` `null` rather than a fabricated value.
 */
export const DecideProposalBodySchema = z.object({
  decidedBy: z.string().min(1).optional(),
  decisionNotes: z.string().min(1).optional(),
});
export type DecideProposalBodyDto = z.infer<typeof DecideProposalBodySchema>;
