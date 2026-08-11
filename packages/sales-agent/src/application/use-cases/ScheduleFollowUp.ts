import type { FollowUpSchedule } from "../../domain/entities/FollowUpSchedule.js";
import type { LeadConversation } from "../../domain/entities/LeadConversation.js";
import type { LeadTemperature } from "../../domain/value-objects/LeadTemperature.js";
import type { FollowUpService } from "../services/FollowUpService.js";

export interface ScheduleFollowUpInput {
  readonly conversation: LeadConversation;
  readonly temperature: LeadTemperature;
  readonly tenantId: string;
  readonly correlationId: string;
}

/** Builds + emits a `FollowUpSchedule` for a COLD/WARM lead (spec "ScheduleFollowUp.ts"). */
export class ScheduleFollowUp {
  constructor(private readonly followUpService: FollowUpService) {}

  async execute(input: ScheduleFollowUpInput): Promise<FollowUpSchedule> {
    return this.followUpService.scheduleAndEmit(
      input.conversation,
      input.temperature,
      input.tenantId,
      input.correlationId,
    );
  }
}
