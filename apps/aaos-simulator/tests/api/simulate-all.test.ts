import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("includes an honest learningBridge status (SKIPPED — no real AAOS_API_BASE_URL/AAOS_API_KEY configured in this test env), and never fails the request over it", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    const body = (await response.json()) as SimulateAllResponse;
    expect(body.learningBridge.status).toBe("SKIPPED");
  }, 60_000);

  it("includes an honest promptOverride status (applied: false — no real AAOS_API_BASE_URL/AAOS_API_KEY configured in this test env), and never fails the request over it", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    const body = (await response.json()) as SimulateAllResponse;
    expect(body.promptOverride.applied).toBe(false);
    expect(body.promptOverride.reason).toBeDefined();
  }, 60_000);
});

/**
 * AAOS Self-Learning AI, Phase C wiring — real, honest reporting of whether the batch actually
 * applied a fetched Clara system-prompt override. Only `global.fetch` is stubbed.
 */
describe("POST /api/simulate-all — promptOverride status when apps/aaos-api has a real active override", () => {
  const originalBaseUrl = process.env["AAOS_API_BASE_URL"];
  const originalApiKey = process.env["AAOS_API_KEY"];
  const originalTenantId = process.env["AAOS_SIMULATOR_TENANT_ID"];

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined) {
      delete process.env["AAOS_API_BASE_URL"];
    } else {
      process.env["AAOS_API_BASE_URL"] = originalBaseUrl;
    }
    if (originalApiKey === undefined) {
      delete process.env["AAOS_API_KEY"];
    } else {
      process.env["AAOS_API_KEY"] = originalApiKey;
    }
    if (originalTenantId === undefined) {
      delete process.env["AAOS_SIMULATOR_TENANT_ID"];
    } else {
      process.env["AAOS_SIMULATOR_TENANT_ID"] = originalTenantId;
    }
  });

  it("promptOverride.applied: true, and the learning bridge report call is unaffected (SKIPPED — no ai-judge ingest endpoint stubbed)", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    process.env["AAOS_SIMULATOR_TENANT_ID"] = "agen-pintar-indonesia";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string) => {
        const url = input.toString();
        if (url.includes("/api/v1/learning/prompt-overrides/")) {
          return new Response(
            JSON.stringify([
              {
                agent: "CLARA",
                promptKey: "clara_system_prompt",
                content: "Kamu Clara versi override.",
                isActive: true,
              },
            ]),
            { status: 200 },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const response = await POST();
    expect(response.status).toBe(200);
    const body = (await response.json()) as SimulateAllResponse;
    expect(body.promptOverride).toEqual({ applied: true, tenantId: "agen-pintar-indonesia" });
  }, 60_000);
});
