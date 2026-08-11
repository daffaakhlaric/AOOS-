import type { JessyAgentEvents } from "../../domain/events/JessyAgentEvents.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";
import type { LeadScore } from "../../domain/value-objects/LeadScore.js";
import type { ScoreDelta } from "../../domain/value-objects/ScoreDelta.js";

export interface RecordScoringInput {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly previousScore: LeadScore;
  readonly appliedDeltas: ReadonlyArray<ScoreDelta>;
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface RecordScoringOutcome {
  readonly newScore: LeadScore;
  readonly becameHot: boolean;
}

/**
 * Score calculation + event emission (spec "LeadScoringService.ts ← score calculation").
 * Re-applies each `ScoreDelta` sequentially through `LeadScore.apply` (clamped at every step —
 * design resolution #6), publishing one `LeadScoreUpdated` per delta and, the moment the running
 * score first crosses `hotThreshold`, a single `LeadBecameHot`.
 */
export class LeadScoringService {
  constructor(
    private readonly events: JessyAgentEvents,
    private readonly hotThreshold: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recordScoring(input: RecordScoringInput): Promise<RecordScoringOutcome> {
    let running = input.previousScore;
    const wasHot = running.isAtLeast(this.hotThreshold);

    for (const delta of input.appliedDeltas) {
      const next = running.apply(delta.amount);
      await this.events.publishLeadScoreUpdated({
        conversationId: input.conversationId,
        leadPhone: input.leadPhone,
        criterion: delta.criterion,
        delta: delta.amount,
        previousScore: running.toNumber(),
        newScore: next.toNumber(),
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt: this.now(),
        version: "1.0",
      });
      running = next;
    }

    const becameHot = !wasHot && running.isAtLeast(this.hotThreshold);
    if (becameHot) {
      await this.events.publishLeadBecameHot({
        conversationId: input.conversationId,
        leadPhone: input.leadPhone,
        branchId: input.branchId,
        score: running.toNumber(),
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt: this.now(),
        version: "1.0",
      });
    }

    return { newScore: running, becameHot };
  }
}
