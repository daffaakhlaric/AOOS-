import { describe, expect, it } from "vitest";

import {
  IndonesianTextGenerator,
  type DigestTextInput,
} from "../../../src/utils/IndonesianTextGenerator.js";

function baseInput(): DigestTextInput {
  return {
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
    autoExecutedSummaryLines: ["Pause 3 iklan boros (hemat Rp 1.200.000)"],
    creativeBriefSummaryLines: ["#ad-1 (BINTARO Xpander) — frequency 4.9x"],
    pendingEscalationSummaryLines: ["Realokasi Rp 3.100.000 dari Bandung"],
    topPerformers: [{ label: "#C051", rphChatIDR: 2_851, conversations: 158 }],
    weeklyRecommendation: "Fokuskan budget ke Cinere & Bintaro Facebook.",
  };
}

describe("IndonesianTextGenerator.generateDigest", () => {
  it("is not empty and contains the Indonesian header", () => {
    const text = IndonesianTextGenerator.generateDigest(baseInput());
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Laporan Harian Tamara");
  });

  it("contains the exact formatted Rupiah figure for currentSpend", () => {
    const text = IndonesianTextGenerator.generateDigest(baseInput());
    expect(text).toContain("Rp 8.500.000");
  });

  it("contains the exact objective progress numbers", () => {
    const text = IndonesianTextGenerator.generateDigest(baseInput());
    expect(text).toContain("Target : 50 hot leads");
    expect(text).toContain("Sekarang : 12 hot leads (24%)");
    expect(text).toContain("46 leads akhir bulan");
    expect(text).toContain("AT RISK");
  });

  it("shows ON TRACK when onTrack is true", () => {
    const text = IndonesianTextGenerator.generateDigest({ ...baseInput(), onTrack: true });
    expect(text).toContain("ON TRACK");
  });

  it("lists auto-executed decisions", () => {
    const text = IndonesianTextGenerator.generateDigest(baseInput());
    expect(text).toContain("Pause 3 iklan boros (hemat Rp 1.200.000)");
  });

  it("lists creative briefs sent", () => {
    const text = IndonesianTextGenerator.generateDigest(baseInput());
    expect(text).toContain("#ad-1 (BINTARO Xpander)");
  });

  it("lists pending escalations", () => {
    const text = IndonesianTextGenerator.generateDigest(baseInput());
    expect(text).toContain("Realokasi Rp 3.100.000 dari Bandung");
  });

  it("lists top performers ranked, with formatted Rupiah", () => {
    const text = IndonesianTextGenerator.generateDigest(baseInput());
    expect(text).toContain("#C051: Rp 2.851/chat (158 chat)");
  });

  it("includes the weekly recommendation", () => {
    const text = IndonesianTextGenerator.generateDigest(baseInput());
    expect(text).toContain("Fokuskan budget ke Cinere & Bintaro Facebook.");
  });

  it("falls back to placeholder lines when there are no auto-executed decisions/briefs/escalations/performers", () => {
    const text = IndonesianTextGenerator.generateDigest({
      ...baseInput(),
      autoExecutedSummaryLines: [],
      creativeBriefSummaryLines: [],
      pendingEscalationSummaryLines: [],
      topPerformers: [],
    });
    expect(text).toContain("Tidak ada aksi auto-execute hari ini");
    expect(text).toContain("Tidak ada creative brief hari ini");
    expect(text).toContain("Tidak ada yang menunggu approval");
    expect(text).toContain("Belum ada data performer hari ini");
  });
});
