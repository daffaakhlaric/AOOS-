import { describe, expect, it } from "vitest";

import { DailyDigest } from "../../../../src/domain/entities/DailyDigest.js";

function baseProps() {
  return {
    tenantId: "dss-motor",
    date: new Date("2026-08-09T00:00:00.000Z"),
    targetHotLeads: 50,
    currentHotLeads: 12,
    progressPercentage: 24,
    forecastedHotLeads: 46,
    onTrack: false,
    budgetAllocatedIDR: 30_000_000,
    budgetSpentIDR: 8_500_000,
    budgetSpentPercentage: 28,
    burnRateIDR: 1_062_500,
    budgetRemainingIDR: 21_500_000,
    daysOfBudgetRemaining: 20,
    autoExecutedSummaryLines: ["Pause 3 iklan boros"],
    creativeBriefSummaryLines: ["#ad-1 — perlu refresh"],
    pendingEscalationSummaryLines: ["Realokasi Rp 3.1 juta"],
    topPerformers: [{ label: "#C051", rphChatIDR: 2851, conversations: 158 }],
    weeklyRecommendation: "Fokuskan budget ke Cinere & Bintaro",
    text: "📊 Laporan Harian Samantha",
  };
}

describe("DailyDigest", () => {
  it("creates a valid digest", () => {
    const result = DailyDigest.create(baseProps());
    expect(result.ok).toBe(true);
  });

  it("rejects an empty tenantId", () => {
    expect(DailyDigest.create({ ...baseProps(), tenantId: "" }).ok).toBe(false);
  });

  it("rejects an empty text", () => {
    expect(DailyDigest.create({ ...baseProps(), text: "" }).ok).toBe(false);
  });

  it("exposes every getter", () => {
    const props = baseProps();
    const digest = DailyDigest.create(props);
    expect(digest.ok).toBe(true);
    if (!digest.ok) return;
    const d = digest.value;
    expect(d.tenantId).toBe("dss-motor");
    expect(d.date).toEqual(props.date);
    expect(d.targetHotLeads).toBe(50);
    expect(d.currentHotLeads).toBe(12);
    expect(d.progressPercentage).toBe(24);
    expect(d.forecastedHotLeads).toBe(46);
    expect(d.onTrack).toBe(false);
    expect(d.budgetAllocatedIDR).toBe(30_000_000);
    expect(d.budgetSpentIDR).toBe(8_500_000);
    expect(d.budgetSpentPercentage).toBe(28);
    expect(d.burnRateIDR).toBe(1_062_500);
    expect(d.budgetRemainingIDR).toBe(21_500_000);
    expect(d.daysOfBudgetRemaining).toBe(20);
    expect(d.autoExecutedSummaryLines).toEqual(["Pause 3 iklan boros"]);
    expect(d.creativeBriefSummaryLines).toEqual(["#ad-1 — perlu refresh"]);
    expect(d.pendingEscalationSummaryLines).toEqual(["Realokasi Rp 3.1 juta"]);
    expect(d.topPerformers).toEqual([{ label: "#C051", rphChatIDR: 2851, conversations: 158 }]);
    expect(d.weeklyRecommendation).toBe("Fokuskan budget ke Cinere & Bintaro");
    expect(d.text).toBe("📊 Laporan Harian Samantha");
  });
});
