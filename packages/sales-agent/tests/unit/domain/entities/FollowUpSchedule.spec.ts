import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { FollowUpSchedule } from "../../../../src/domain/entities/FollowUpSchedule.js";
import { FollowUpDay } from "../../../../src/domain/value-objects/FollowUpDay.js";
import { LeadTemperature } from "../../../../src/domain/value-objects/LeadTemperature.js";

const FROM = new Date("2026-08-10T09:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("FollowUpSchedule", () => {
  it("create() exposes leadPhone/branchId/temperature/entries", () => {
    const schedule = FollowUpSchedule.create({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      temperature: LeadTemperature.COLD,
      entries: [{ day: FollowUpDay.D3, scheduledAt: new Date(FROM.getTime() + 3 * DAY_MS) }],
    });
    expect(schedule.leadPhone).toBe("+6281200000001");
    expect(schedule.branchId).toBe(BranchId.CINERE);
    expect(schedule.temperature).toBe(LeadTemperature.COLD);
    expect(schedule.entries).toHaveLength(1);
  });

  it("nextEntry() returns the first not-yet-elapsed entry", () => {
    const schedule = FollowUpSchedule.create({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      temperature: LeadTemperature.COLD,
      entries: [
        { day: FollowUpDay.D3, scheduledAt: new Date(FROM.getTime() + 3 * DAY_MS) },
        { day: FollowUpDay.D7, scheduledAt: new Date(FROM.getTime() + 7 * DAY_MS) },
      ],
    });
    const next = schedule.nextEntry(new Date(FROM.getTime() + 4 * DAY_MS));
    expect(next?.day).toBe(FollowUpDay.D7);
  });

  it("nextEntry() returns undefined once all entries have elapsed", () => {
    const schedule = FollowUpSchedule.create({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      temperature: LeadTemperature.COLD,
      entries: [{ day: FollowUpDay.D3, scheduledAt: new Date(FROM.getTime() + 3 * DAY_MS) }],
    });
    const next = schedule.nextEntry(new Date(FROM.getTime() + 30 * DAY_MS));
    expect(next).toBeUndefined();
  });
});
