import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { FollowUpService } from "../../../../src/application/services/FollowUpService.js";
import { LeadConversation } from "../../../../src/domain/entities/LeadConversation.js";
import { JessyAgentEvents } from "../../../../src/domain/events/JessyAgentEvents.js";
import { FollowUpDay } from "../../../../src/domain/value-objects/FollowUpDay.js";
import { LeadTemperature } from "../../../../src/domain/value-objects/LeadTemperature.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const NOW = new Date("2026-08-10T09:00:00.000Z");
const TIMEOUT_MS = 21_600_000;

describe("FollowUpService", () => {
  it("schedule() COLD → D3/D7/D14", () => {
    const service = new FollowUpService(
      new JessyAgentEvents(createFakePublisher()),
      TIMEOUT_MS,
      () => NOW,
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    const schedule = service.schedule(conversation, LeadTemperature.COLD, NOW);
    expect(schedule.entries.map((e) => e.day)).toEqual([
      FollowUpDay.D3,
      FollowUpDay.D7,
      FollowUpDay.D14,
    ]);
  });

  it("scheduleAndEmit() publishes FollowUpScheduled", async () => {
    const publisher = createFakePublisher();
    const service = new FollowUpService(new JessyAgentEvents(publisher), TIMEOUT_MS, () => NOW);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    await service.scheduleAndEmit(conversation, LeadTemperature.WARM, "tenant-dss-motor", "corr-1");
    expect(publisher.published.some((p) => p.type === "aaos.sales.follow-up.scheduled")).toBe(true);
  });

  it("applyNoReplyPenaltyIfStale() leaves the score unchanged before the timeout", () => {
    const service = new FollowUpService(
      new JessyAgentEvents(createFakePublisher()),
      TIMEOUT_MS,
      () => new Date(NOW.getTime() + 1000),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    expect(service.applyNoReplyPenaltyIfStale(conversation).toNumber()).toBe(0);
  });

  it("applyNoReplyPenaltyIfStale() applies the -10 NO_REPLY penalty once stale, using the injectable clock", () => {
    const service = new FollowUpService(
      new JessyAgentEvents(createFakePublisher()),
      TIMEOUT_MS,
      () => new Date(NOW.getTime() + TIMEOUT_MS),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).withScore(
      LeadConversation.start("+6281200000001", BranchId.CINERE, NOW).score.apply(20),
    );
    expect(service.applyNoReplyPenaltyIfStale(conversation).toNumber()).toBe(10);
  });

  it("applyNoReplyPenaltyIfStale() clamps at 0 (floor)", () => {
    const service = new FollowUpService(
      new JessyAgentEvents(createFakePublisher()),
      TIMEOUT_MS,
      () => new Date(NOW.getTime() + TIMEOUT_MS),
    );
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, NOW);
    expect(service.applyNoReplyPenaltyIfStale(conversation).toNumber()).toBe(0);
  });

  it("uses the real wall clock when no clock is injected", () => {
    const service = new FollowUpService(new JessyAgentEvents(createFakePublisher()), TIMEOUT_MS);
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, new Date());
    expect(service.applyNoReplyPenaltyIfStale(conversation).toNumber()).toBe(0);
  });
});
