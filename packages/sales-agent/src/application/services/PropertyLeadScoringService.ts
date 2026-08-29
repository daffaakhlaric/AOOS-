import type { ClaraAgentEvents } from "../../domain/events/ClaraAgentEvents.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";
import type { LeadScore } from "../../domain/value-objects/LeadScore.js";
import type { PropertyScoreDelta } from "../../domain/value-objects/PropertyScoreDelta.js";

export interface RecordPropertyScoringInput {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly previousScore: LeadScore;
  readonly appliedDeltas: ReadonlyArray<PropertyScoreDelta>;
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface RecordPropertyScoringOutcome {
  readonly newScore: LeadScore;
  readonly becameHot: boolean;
}

/**
 * PROPERTY-vertical sibling to `LeadScoringService` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8,
 * spec section 12 point 2): score calculation + event emission over `PropertyScoreDelta`. A real,
 * additive sibling — confirmed via direct read that `LeadScoringService.recordScoring`'s
 * `appliedDeltas: ReadonlyArray<ScoreDelta>` and the `LeadScoreUpdated.criterion: ScoringCriterion`
 * event payload are both concretely automotive-typed, so `PropertyScoreDelta[]` cannot be passed to
 * it as-is (not a small wiring pass, despite the coordinator note's initial assumption that this
 * service was already vertical-generic). Same clamping/threshold-crossing discipline as the
 * automotive original.
 */
export class PropertyLeadScoringService {
  constructor(
    private readonly events: ClaraAgentEvents,
    private readonly hotThreshold: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recordScoring(input: RecordPropertyScoringInput): Promise<RecordPropertyScoringOutcome> {
    let running = input.previousScore;
    const wasHot = running.isAtLeast(this.hotThreshold);

    for (const delta of input.appliedDeltas) {
      const next = running.apply(delta.amount);
      await this.events.publishPropertyLeadScoreUpdated({
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
