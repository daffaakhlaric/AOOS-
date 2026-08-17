import { afterEach, describe, expect, it, vi } from "vitest";

import { AaosSimulatorError, callAaosSimulator } from "./aaos-simulator-client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const VALID_BODY = {
  simulationResult: {
    finalScore: 80,
    finalTemperature: "HOT",
    handoffTriggered: true,
    totalTurns: 6,
  },
  judgementResult: {
    overallScore: 88,
    grade: "B",
    verdict: "APPROVED",
    feedbackItems: [{ dimension: "naturalLanguage", message: "good" }],
  },
};

describe("callAaosSimulator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the flattened result on a valid 200 response", async () => {
    global.fetch = vi.fn(async () => jsonResponse(VALID_BODY)) as unknown as typeof fetch;
    const result = await callAaosSimulator("http://localhost:4100", "ready_buyer");
    expect(result.overallScore).toBe(88);
    expect(result.finalScore).toBe(80);
  });

  it("throws AaosSimulatorError on a network failure", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(callAaosSimulator("http://localhost:4100", "ready_buyer")).rejects.toThrow(
      AaosSimulatorError,
    );
  });

  it("throws AaosSimulatorError on a non-2xx response", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { code: "VALIDATION_ERROR", message: "bad persona" } }, 400),
    ) as unknown as typeof fetch;
    await expect(callAaosSimulator("http://localhost:4100", "unknown_persona")).rejects.toThrow(
      AaosSimulatorError,
    );
  });

  it("throws AaosSimulatorError when the response fails the Zod shape check", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ unexpected: true })) as unknown as typeof fetch;
    await expect(callAaosSimulator("http://localhost:4100", "ready_buyer")).rejects.toThrow(
      AaosSimulatorError,
    );
  });
});
