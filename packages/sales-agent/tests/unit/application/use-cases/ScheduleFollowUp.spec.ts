import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { FollowUpService } from "../../../../src/application/services/FollowUpService.js";
import { ScheduleFollowUp } from "../../../../src/application/use-cases/ScheduleFollowUp.js";
import { LeadConversation } from "../../../../src/domain/entities/LeadConversation.js";
import { JessyAgentEvents } from "../../../../src/domain/events/JessyAgentEvents.js";
import { FollowUpDay } from "../../../../src/domain/value-objects/FollowUpDay.js";
import { LeadTemperature } from "../../../../src/domain/value-objects/LeadTemperature.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");

describe("ScheduleFollowUp", () => {
  it("builds + emits a schedule for a COLD lead", async () => {
    const publisher = createFakePublisher();
    const service = new FollowUpService(new JessyAgentEvents(publisher), 21_600_000, () => NOW);
    const useCase = new ScheduleFollowUp(service);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const schedule = await useCase.execute({
      conversation,
      temperature: LeadTemperature.COLD,
      tenantId: "tenant-dss-motor",
      correlationId: "corr-1",
    });
    expect(schedule.entries.map((e) => e.day)).toEqual([
      FollowUpDay.D3,
      FollowUpDay.D7,
      FollowUpDay.D14,
    ]);
    expect(publisher.published.some((p) => p.type === "aaos.sales.follow-up.scheduled")).toBe(true);
  });
});
