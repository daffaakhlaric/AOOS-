import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/simulate-all/route";
import type { SimulateAllResponse } from "@/types/simulator.types";

/**
 * Real, end-to-end route handler test — runs all 10 real personas through
 * `@aos/conversation-simulator`'s `RunAllScenarios` and `@aos/ai-judge`'s `JudgeAllScenarios`,
 * never mocked (design resolution #5). Longer timeout: 10 full simulations + 10 judgements.
 */
describe("POST /api/simulate-all", () => {
  it("returns 200 with exactly 10 results and a populated report", async () => {
    const response = await POST();
    expect(response.status).toBe(200);

    const body = (await response.json()) as SimulateAllResponse;
    expect(body.results).toHaveLength(10);
    expect(body.report.totalPersonas).toBe(10);
  }, 60_000);

  it("report includes overallVerdict, avgOverallScore, weakestDimensions, and topPriorities", async () => {
    const response = await POST();
    const body = (await response.json()) as SimulateAllResponse;

    expect(["APPROVE", "NEEDS_IMPROVEMENT", "FAIL"]).toContain(body.report.overallVerdict);
    expect(body.report.avgOverallScore).toBeGreaterThanOrEqual(0);
    expect(body.report.avgOverallScore).toBeLessThanOrEqual(100);
    expect(body.report.weakestDimensions.length).toBeGreaterThan(0);
    expect(Array.isArray(body.report.topPriorities)).toBe(true);
  }, 60_000);

  it("each result pairs a real simulationResult with a real judgementResult for the same persona", async () => {
    const response = await POST();
    const body = (await response.json()) as SimulateAllResponse;

    for (const entry of body.results) {
      expect(entry.simulationResult.personaId).toBe(entry.personaId);
      expect(entry.judgementResult.personaId).toBe(entry.personaId);
    }
  }, 60_000);

  it("approvedCount + needsImprovementCount + failCount adds up to totalPersonas", async () => {
    const response = await POST();
    const body = (await response.json()) as SimulateAllResponse;
    const { approvedCount, needsImprovementCount, failCount, totalPersonas } = body.report;
    expect(approvedCount + needsImprovementCount + failCount).toBe(totalPersonas);
  }, 60_000);
});
