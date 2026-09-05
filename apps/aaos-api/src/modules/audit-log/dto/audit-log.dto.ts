import { z } from "zod";

import type { AuditLogRow } from "../infrastructure/audit-log.repository.js";

/** `POST /api/v1/audit-log/:id/rollback` body. `decidedBy` mirrors `DecideProposalBodySchema`'s own optional-actor reasoning — a caller with no resolvable session email just leaves the new ROLLBACK row's `user_id` `null`. */
export const RollbackAuditLogBodySchema = z.object({
  decidedBy: z.string().min(1).optional(),
});
export type RollbackAuditLogBodyDto = z.infer<typeof RollbackAuditLogBodySchema>;

/** COLUMN-FOR-COLUMN projection of an `audit_log` row (mirrors `PropertyObjectiveResponseDto`'s flattening convention). */
export interface AuditLogResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly actionType: string;
  readonly beforeState: unknown;
  readonly afterState: unknown;
  readonly decidedBy: "ai_auto" | "user_manual";
  readonly userId?: string;
  readonly mode: "DEV" | "LIVE";
  readonly relatedVerdictId?: string;
  readonly relatedBriefId?: string;
  readonly reversible: boolean;
  readonly createdAt: string;
}

export function toAuditLogResponseDto(row: AuditLogRow): AuditLogResponseDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    agent: row.agent,
    actionType: row.action_type,
    beforeState: row.before_state,
    afterState: row.after_state,
    decidedBy: row.decided_by,
    ...(row.user_id !== null ? { userId: row.user_id } : {}),
    mode: row.mode,
    ...(row.related_verdict_id !== null ? { relatedVerdictId: row.related_verdict_id } : {}),
    ...(row.related_brief_id !== null ? { relatedBriefId: row.related_brief_id } : {}),
    reversible: row.reversible,
    createdAt: row.created_at,
  };
}
