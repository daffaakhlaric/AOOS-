import { FollowUpScheduleBuilder } from "../../builders/FollowUpScheduleBuilder.js";
import type { IFollowUpScheduler } from "../../contracts/IFollowUpScheduler.js";
import type { FollowUpSchedule } from "../../domain/entities/FollowUpSchedule.js";
import type { LeadConversation } from "../../domain/entities/LeadConversation.js";
import type { JessyAgentEvents } from "../../domain/events/JessyAgentEvents.js";
import type { LeadScore } from "../../domain/value-objects/LeadScore.js";
import type { LeadTemperature } from "../../domain/value-objects/LeadTemperature.js";
import { ScoreCalculator } from "../../scoring/ScoreCalculator.js";

/**
 * Follow-up scheduling (spec "FollowUpService.ts ← follow up scheduling") AND the timeout-driven
 * `NO_REPLY` scoring path (design resolution #3): `SCORING_RULES.NO_REPLY` has `detect: () =>
 * false` on purpose — it is never triggered by the per-message `ScoreCalculator` loop. The `-10`
 * penalty is instead applied here, via `applyNoReplyPenaltyIfStale`, driven by an injectable clock
 * (`now`) rather than `Date.now()`, so it stays deterministically testable.
 */
export class FollowUpService implements IFollowUpScheduler {
  constructor(
    private readonly events: JessyAgentEvents,
    private readonly noReplyTimeoutMs: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  schedule(
    conversation: LeadConversation,
    temperature: LeadTemperature,
    from: Date,
  ): FollowUpSchedule {
    return FollowUpScheduleBuilder.build(conversation, temperature, from);
  }

  async scheduleAndEmit(
    conversation: LeadConversation,
    temperature: LeadTemperature,
    tenantId: string,
    correlationId: string,
  ): Promise<FollowUpSchedule> {
    const schedule = this.schedule(conversation, temperature, this.now());
    await this.events.publishFollowUpScheduled({
      leadPhone: conversation.leadPhone,
      branchId: conversation.branchId,
      temperature,
      days: schedule.entries.map((entry) => entry.day as number),
      tenantId,
      correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });
    return schedule;
  }

  /**
   * If `conversation` has gone quiet past `noReplyTimeoutMs` (as of the injected clock), applies
   * the `NO_REPLY` `-10` penalty (clamped — design resolution #6) and returns the new score;
   * otherwise returns the conversation's current score unchanged.
   */
  applyNoReplyPenaltyIfStale(conversation: LeadConversation): LeadScore {
    const at = this.now();
    if (!conversation.isStale(this.noReplyTimeoutMs, at)) {
      return conversation.score;
    }
    return conversation.score.apply(ScoreCalculator.noReplyDelta().amount);
  }
}
