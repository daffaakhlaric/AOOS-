import type { LearningProposalRow } from "../infrastructure/learning-proposal.repository.js";

/** `GET /api/v1/learning/proposals*` real response shape (AAOS Self-Learning AI, Phase C) — camelCase mapping of the raw `learning_proposals` row, same `toXResponseDto(row)` convention `activity-log.dto.ts`'s `toActivityResponseDto` already establishes for this app's other real list endpoints. */
export interface LearningProposalResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly simulationId: string | null;
  readonly agent: string;
  readonly analysis: string | null;
  readonly gaps: Record<string, unknown>;
  readonly improvements: readonly Record<string, unknown>[];
  readonly status: string;
  readonly decidedBy: string | null;
  readonly decisionNotes: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
}

export function toLearningProposalResponseDto(
  row: LearningProposalRow,
): LearningProposalResponseDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    simulationId: row.simulation_id,
    agent: row.agent,
    analysis: row.analysis,
    gaps: row.gaps,
    improvements: row.improvements,
    status: row.status,
    decidedBy: row.decided_by,
    decisionNotes: row.decision_notes,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}
