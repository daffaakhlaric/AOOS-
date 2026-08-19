import type { ScoringEvent } from "@aos/lead-store";

/**
 * `GET /api/v1/leads/:id/scoring-history` — a thin JSON projection of `@aos/lead-store`'s real
 * `ScoringEvent` entity (coordinator note #5: "no new domain logic"), in `created_at` ascending
 * order (`ScoringRepository.findByLeadId`'s own order) — the same chronological order the chat
 * room's score-timeline card renders.
 */
export interface ScoringEventResponseDto {
  readonly id: string;
  readonly leadId: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly delta: number;
  readonly reason: string;
  readonly triggeredBy?: string;
  readonly createdAt: string;
}

export function toScoringEventResponseDto(event: ScoringEvent): ScoringEventResponseDto {
  return {
    id: event.id,
    leadId: event.leadId.toString(),
    scoreBefore: event.scoreBefore,
    scoreAfter: event.scoreAfter,
    delta: event.delta,
    reason: event.reason,
    triggeredBy: event.triggeredBy,
    createdAt: event.createdAt.toISOString(),
  };
}
