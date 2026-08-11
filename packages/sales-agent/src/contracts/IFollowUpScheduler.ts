import type { FollowUpSchedule } from "../domain/entities/FollowUpSchedule.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import type { LeadTemperature } from "../domain/value-objects/LeadTemperature.js";

/** Port: builds a `FollowUpSchedule` (D3/D7/D14 for COLD, D1/D3/D7 for WARM) for a given conversation. */
export interface IFollowUpScheduler {
  schedule(
    conversation: LeadConversation,
    temperature: LeadTemperature,
    from: Date,
  ): FollowUpSchedule;
}
