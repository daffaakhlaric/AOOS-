import { describe, expect, it } from "vitest";
import { matchesDecision, portfolioTotals, upcomingReviews } from "@/lib/samantha-portfolio";
import type { CampaignHealthSummaryEntryDto } from "@/types/dashboard.types";
describe("Samantha portfolio source semantics", () => {
  it("distinguishes unavailable totals from a loaded empty portfolio", () => {
    expect(portfolioTotals(undefined)).toBeUndefined();
    expect(portfolioTotals([])).toEqual({ spend: 0, leads: 0 });
  });
  it("does not treat a generic FIX as confirmed tracking trouble", () => {
    const entry = {
      decision: { decision: "FIX" },
      health: { tracking: { status: "UNKNOWN" } },
    } as CampaignHealthSummaryEntryDto;
    expect(matchesDecision(entry, "Tracking")).toBe(false);
    expect(matchesDecision(entry, "Perlu Aksi")).toBe(true);
    expect(
      matchesDecision({ ...entry, decision: { ...entry.decision, decision: "MONITOR" } }, "Hold"),
    ).toBe(true);
  });
  it("uses only persisted future pending Samantha reviews including legacy aliases", () => {
    const event = {
      id: "1",
      title: "Analyze",
      eventType: "TAMARA_ANALYZE",
      status: "PENDING",
      scheduledAt: "2026-10-02T03:00:00Z",
      recurrence: "DAILY",
    };
    expect(
      upcomingReviews(
        [
          event,
          { ...event, id: "2", status: "DONE" },
          { ...event, id: "3", eventType: "KAI_REFRESH_CHECK" },
          { ...event, id: "4", scheduledAt: "2026-09-01T00:00:00Z" },
        ],
        Date.parse("2026-10-01"),
      ),
    ).toEqual([event]);
  });
});
