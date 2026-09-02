import type { PendingActionRow } from "../infrastructure/pending-action.repository.js";

/** `GET/POST /api/v1/pending-actions*` real response shape — camelCase mapping of the raw `pending_agent_actions` row, same `toXResponseDto(row)` convention `toLearningProposalResponseDto` already establishes for this app's other real list endpoints. */
export interface PendingActionResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly actionType: string;
  readonly payload: Record<string, unknown>;
  readonly status: string;
  readonly decidedBy: string | null;
  readonly decisionNotes: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
}

export function toPendingActionResponseDto(row: PendingActionRow): PendingActionResponseDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    agent: row.agent,
    actionType: row.action_type,
    payload: row.payload,
    status: row.status,
    decidedBy: row.decided_by,
    decisionNotes: row.decision_notes,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}
