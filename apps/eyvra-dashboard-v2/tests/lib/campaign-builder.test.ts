import { expect, it } from "vitest";
import { budgetPeriod, validDraft } from "@/lib/campaign-builder";
it("computes inclusive dates and rejects reversed dates", () => {
  expect(budgetPeriod("2026-09-24", "2026-09-26", 300000)).toEqual({
    days: 3,
    total: 900000,
    valid: true,
  });
  expect(budgetPeriod("2026-09-26", "2026-09-24", 300000).valid).toBe(false);
});
it("rejects unsafe IDs and invalid goals", () => {
  expect(validDraft({ id: "../../escape", listingId: "a" })).toBe(false);
});
