import { BranchId } from "@aos/branch-manager";
import { LeadBuilder, type Lead, type LeadQualificationFlags } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { LeadIntelService } from "../../../src/intelligence/LeadIntelService.js";

const FULL_QUALIFICATION: LeadQualificationFlags = {
  budget: true,
  unit: true,
  area: true,
  payment: true,
  timeline: true,
  name: true,
};

const EMPTY_QUALIFICATION: LeadQualificationFlags = {
  budget: false,
  unit: false,
  area: false,
  payment: false,
  timeline: false,
  name: false,
};

function buildLead(overrides: {
  branchId?: BranchId;
  score?: number;
  qualification?: LeadQualificationFlags;
  createdAt?: Date;
}): Lead {
  const result = new LeadBuilder()
    .withBranchId(overrides.branchId ?? BranchId.BINTARO)
    .withScore(overrides.score ?? 50)
    .withQualification(overrides.qualification ?? EMPTY_QUALIFICATION)
    .withCreatedAt(overrides.createdAt ?? new Date("2026-01-01T10:00:00.000Z"))
    .build();
  if (!result.ok) {
    throw new Error(`fixture build failed: ${result.error.message}`);
  }
  return result.value;
}

describe("LeadIntelService.getHotLeadProfile", () => {
  it("returns all-zero/undefined signals for an empty input", () => {
    const signal = LeadIntelService.getHotLeadProfile([]);
    expect(signal.totalLeads).toBe(0);
    expect(signal.avgScore).toBe(0);
    expect(signal.topBranches).toEqual([]);
    expect(signal.peakHour).toBeUndefined();
    expect(signal.peakDay).toBeUndefined();
    for (const rate of Object.values(signal.qualificationCompletionRate)) {
      expect(rate).toBe(0);
    }
  });

  it("computes avgScore across leads", () => {
    const leads = [buildLead({ score: 60 }), buildLead({ score: 80 })];
    const signal = LeadIntelService.getHotLeadProfile(leads);
    expect(signal.avgScore).toBe(70);
  });

  it("ranks branches by lead count, descending", () => {
    const leads = [
      buildLead({ branchId: BranchId.CINERE }),
      buildLead({ branchId: BranchId.BINTARO }),
      buildLead({ branchId: BranchId.BINTARO }),
    ];
    const signal = LeadIntelService.getHotLeadProfile(leads);
    expect(signal.topBranches).toEqual([
      { branchId: String(BranchId.BINTARO), count: 2 },
      { branchId: String(BranchId.CINERE), count: 1 },
    ]);
  });

  it("computes qualification completion rate as a real fraction of leads with each flag true", () => {
    const leads = [
      buildLead({ qualification: FULL_QUALIFICATION }),
      buildLead({ qualification: EMPTY_QUALIFICATION }),
    ];
    const signal = LeadIntelService.getHotLeadProfile(leads);
    expect(signal.qualificationCompletionRate).toEqual({
      budget: 0.5,
      unit: 0.5,
      area: 0.5,
      payment: 0.5,
      timeline: 0.5,
      name: 0.5,
    });
  });

  it("finds the most common hour and day-of-week from real createdAt values", () => {
    const leads = [
      buildLead({ createdAt: new Date("2026-01-05T10:00:00.000Z") }), // Monday 10:00 UTC
      buildLead({ createdAt: new Date("2026-01-12T10:00:00.000Z") }), // Monday 10:00 UTC
      buildLead({ createdAt: new Date("2026-01-06T14:00:00.000Z") }), // Tuesday 14:00 UTC
    ];
    const signal = LeadIntelService.getHotLeadProfile(leads);
    expect(signal.peakHour).toBe(new Date("2026-01-05T10:00:00.000Z").getHours());
    expect(signal.peakDay).toBe(new Date("2026-01-05T10:00:00.000Z").getDay());
  });
});
