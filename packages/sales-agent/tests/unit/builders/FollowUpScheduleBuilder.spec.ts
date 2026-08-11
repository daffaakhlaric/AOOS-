import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { FollowUpScheduleBuilder } from "../../../src/builders/FollowUpScheduleBuilder.js";
import { LeadConversation } from "../../../src/domain/entities/LeadConversation.js";
import { FollowUpDay } from "../../../src/domain/value-objects/FollowUpDay.js";
import { LeadTemperature } from "../../../src/domain/value-objects/LeadTemperature.js";

const FROM = new Date("2026-08-10T09:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("FollowUpScheduleBuilder", () => {
  it("COLD → D3/D7/D14", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, FROM);
    const schedule = FollowUpScheduleBuilder.build(conversation, LeadTemperature.COLD, FROM);
    expect(schedule.entries.map((e) => e.day)).toEqual([
      FollowUpDay.D3,
      FollowUpDay.D7,
      FollowUpDay.D14,
    ]);
  });

  it("WARM → D1/D3/D7", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, FROM);
    const schedule = FollowUpScheduleBuilder.build(conversation, LeadTemperature.WARM, FROM);
    expect(schedule.entries.map((e) => e.day)).toEqual([
      FollowUpDay.D1,
      FollowUpDay.D3,
      FollowUpDay.D7,
    ]);
  });

  it("scheduledAt is offset from 'from' by exactly the day count", () => {
    const conversation = LeadConversation.start("+6281200000001", BranchId.CINERE, FROM);
    const schedule = FollowUpScheduleBuilder.build(conversation, LeadTemperature.COLD, FROM);
    expect(schedule.entries[0]!.scheduledAt.getTime()).toBe(FROM.getTime() + 3 * DAY_MS);
    expect(schedule.entries[2]!.scheduledAt.getTime()).toBe(FROM.getTime() + 14 * DAY_MS);
  });

  it("carries the conversation's leadPhone and branchId", () => {
    const conversation = LeadConversation.start("+6281200000099", BranchId.BANDUNG, FROM);
    const schedule = FollowUpScheduleBuilder.build(conversation, LeadTemperature.COLD, FROM);
    expect(schedule.leadPhone).toBe("+6281200000099");
    expect(schedule.branchId).toBe(BranchId.BANDUNG);
  });
});
