import { FollowUpSchedule } from "../domain/entities/FollowUpSchedule.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import { FollowUpDay } from "../domain/value-objects/FollowUpDay.js";
import { LeadTemperature } from "../domain/value-objects/LeadTemperature.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const COLD_DAYS: ReadonlyArray<FollowUpDay> = [FollowUpDay.D3, FollowUpDay.D7, FollowUpDay.D14];
const WARM_DAYS: ReadonlyArray<FollowUpDay> = [FollowUpDay.D1, FollowUpDay.D3, FollowUpDay.D7];

/**
 * Builder Pattern: builds a `FollowUpSchedule` per the spec's `FOLLOW_UP_SCHEDULE` table — COLD
 * leads get D3/D7/D14, WARM leads get D1/D3/D7 (design resolution — see `FollowUpDay.ts`'s
 * docstring for why `D1` exists). HOT leads never get a schedule (already handed off) — callers
 * (`FollowUpService`) are responsible for not calling this for HOT.
 */
export class FollowUpScheduleBuilder {
  static build(
    conversation: LeadConversation,
    temperature: LeadTemperature,
    from: Date,
  ): FollowUpSchedule {
    const days = temperature === LeadTemperature.WARM ? WARM_DAYS : COLD_DAYS;
    return FollowUpSchedule.create({
      leadPhone: conversation.leadPhone,
      branchId: conversation.branchId,
      temperature,
      entries: days.map((day) => ({
        day,
        scheduledAt: new Date(from.getTime() + day * DAY_MS),
      })),
    });
  }
}
