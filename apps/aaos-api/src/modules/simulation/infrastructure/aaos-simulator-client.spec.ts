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

  it("sends only personaId in the body when vertical/listingId are omitted (every existing caller's behavior unchanged)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(VALID_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;
    await callAaosSimulator("http://localhost:4100", "ready_buyer");
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ personaId: "ready_buyer" });
  });

  it("sends vertical + listingId in the body when both are provided (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(VALID_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;
    await callAaosSimulator("http://localhost:4100", "ready_buyer", "PROPERTY", "listing-1");
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      personaId: "ready_buyer",
      vertical: "PROPERTY",
      listingId: "listing-1",
    });
  });

  it("sends only vertical when listingId is omitted", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(VALID_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;
    await callAaosSimulator("http://localhost:4100", "ready_buyer", "AUTOMOTIVE");
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      personaId: "ready_buyer",
      vertical: "AUTOMOTIVE",
    });
  });
});
