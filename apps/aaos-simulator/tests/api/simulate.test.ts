import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/simulate/route";
import type { ApiErrorResponse, SimulateResponse } from "@/types/simulator.types";

/**
 * Real, end-to-end route handler tests — `POST` here runs the actual `@aos/conversation-simulator`
 * `SimulatorFactory`/`RunSimulation` and `@aos/ai-judge` `AiJudgeFactory`/`JudgeConversation`
 * (design resolution #5: this is the only layer allowed to import them), never mocked. A minimal
 * `{ json: () => Promise<unknown> }` object stands in for `NextRequest` — the handler only ever
 * calls `.json()` on it.
 */
function requestWith(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("POST /api/simulate", () => {
  it("returns 200 with simulationResult + judgementResult for a valid personaId", async () => {
    const response = await POST(requestWith({ personaId: "ready_buyer" }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as SimulateResponse;
    expect(body.simulationResult).toBeDefined();
    expect(body.simulationResult.personaId).toBe("ready_buyer");
    expect(body.simulationResult.messages.length).toBeGreaterThan(0);
    expect(body.judgementResult).toBeDefined();
    expect(body.judgementResult.overallScore).toBeGreaterThanOrEqual(0);
    expect(body.judgementResult.overallScore).toBeLessThanOrEqual(100);
    expect(["A", "B+", "B", "C", "F"]).toContain(body.judgementResult.grade);
    expect(["APPROVE", "NEEDS_IMPROVEMENT", "FAIL"]).toContain(body.judgementResult.verdict);
  }, 20_000);

  it("returns 400 for a personaId that isn't one of the 10 real persona ids", async () => {
    const response = await POST(requestWith({ personaId: "not_a_real_persona" }));
    expect(response.status).toBe(400);

    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when personaId is missing", async () => {
    const response = await POST(requestWith({}));
    expect(response.status).toBe(400);
  });

  it("returns 400 when personaId is not a string", async () => {
    const response = await POST(requestWith({ personaId: 42 }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const badRequest = {
      json: () => Promise.reject(new Error("Unexpected token")),
    } as unknown as NextRequest;
    const response = await POST(badRequest);
    expect(response.status).toBe(400);
  });

  it("produces a full 6-dimension score for the same real simulation it ran", async () => {
    const response = await POST(requestWith({ personaId: "urgent_buyer" }));
    const body = (await response.json()) as SimulateResponse;

    expect(body.judgementResult.naturalLanguage.score).toBeGreaterThanOrEqual(0);
    expect(body.judgementResult.qualification.score).toBeGreaterThanOrEqual(0);
    expect(body.judgementResult.objectionHandling.score).toBeGreaterThanOrEqual(0);
    expect(body.judgementResult.closingAttempt.score).toBeGreaterThanOrEqual(0);
    expect(body.judgementResult.handoffQuality.score).toBeGreaterThanOrEqual(0);
    expect(body.judgementResult.responseLength.score).toBeGreaterThanOrEqual(0);
  }, 20_000);
});

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 (spec section 12 point 4) — `vertical`/`listingId`
 * request body additions. Real end-to-end route handler tests, same discipline as the automotive
 * tests above: only `global.fetch` (the real `apps/aaos-api` HTTP boundary `src/lib/aaos-api-
 * client.ts` calls) is ever stubbed — `@aos/conversation-simulator`/`@aos/ai-judge` run for real.
 */
describe("POST /api/simulate (vertical: PROPERTY)", () => {
  const originalBaseUrl = process.env["AAOS_API_BASE_URL"];
  const originalApiKey = process.env["AAOS_API_KEY"];

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
  });

  it("returns 400 for a vertical that isn't AUTOMOTIVE or PROPERTY", async () => {
    const response = await POST(requestWith({ personaId: "cold_buyer", vertical: "SOMETHING" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when listingId is not a string", async () => {
    const response = await POST(requestWith({ personaId: "cold_buyer", listingId: 42 }));
    expect(response.status).toBe(400);
  });

  it("runs a real PROPERTY-vertical simulation end-to-end with no AAOS_API_BASE_URL/AAOS_API_KEY configured (real degraded state — 0 listings, never a hard failure)", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    delete process.env["AAOS_API_KEY"];

    const response = await POST(
      requestWith({ personaId: "cold_buyer", vertical: "PROPERTY", listingId: "listing-1" }),
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as SimulateResponse;
    expect(body.simulationResult.messages.length).toBeGreaterThan(0);
  }, 20_000);

  it("runs a real PROPERTY-vertical simulation end-to-end, fetching the real listing from aaos-api when AAOS_API_BASE_URL/AAOS_API_KEY are configured", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "listing-1",
            title: "Rumah Minimalis Cinere",
            propertyType: "RUMAH",
            price: 1_500_000_000,
            city: "Cinere",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      requestWith({ personaId: "ready_buyer", vertical: "PROPERTY", listingId: "listing-1" }),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = (await response.json()) as SimulateResponse;
    expect(body.simulationResult.messages.length).toBeGreaterThan(0);
  }, 20_000);

  it("omitting vertical entirely defaults to AUTOMOTIVE (no aaos-api fetch attempted when AAOS_API_BASE_URL/AAOS_API_KEY are unset)", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    delete process.env["AAOS_API_KEY"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(requestWith({ personaId: "cold_buyer" }));
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  }, 20_000);
});

/**
 * AAOS Self-Learning AI, Phase C wiring — real, honest reporting of whether a fetched Clara
 * system-prompt override was actually applied to this run (never invisible/unverifiable, per the
 * task's own explicit requirement). Only `global.fetch` (the real `apps/aaos-api` HTTP boundary) is
 * ever stubbed — `@aos/conversation-simulator`/`@aos/ai-judge` run for real.
 */
describe("POST /api/simulate — promptOverride status", () => {
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

  it("promptOverride.applied: false with a reason when AAOS_API_BASE_URL/AAOS_API_KEY are unset (today's real, unchanged default)", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    delete process.env["AAOS_API_KEY"];

    const response = await POST(requestWith({ personaId: "cold_buyer" }));
    const body = (await response.json()) as SimulateResponse;
    expect(body.promptOverride.applied).toBe(false);
    expect(body.promptOverride.reason).toBeDefined();
  }, 20_000);

  it("promptOverride.applied: true when apps/aaos-api has a real active CLARA/clara_system_prompt override for this tenant", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    process.env["AAOS_SIMULATOR_TENANT_ID"] = "agen-pintar-indonesia";

    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe("/api/v1/learning/prompt-overrides/agen-pintar-indonesia/active");
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
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(requestWith({ personaId: "cold_buyer" }));
    const body = (await response.json()) as SimulateResponse;
    expect(body.promptOverride).toEqual({ applied: true, tenantId: "agen-pintar-indonesia" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("PROPERTY vertical never fetches a prompt override (no LLM path there)", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    delete process.env["AAOS_API_KEY"];

    const response = await POST(
      requestWith({ personaId: "cold_buyer", vertical: "PROPERTY", listingId: "listing-1" }),
    );
    const body = (await response.json()) as SimulateResponse;
    expect(body.promptOverride.applied).toBe(false);
  }, 20_000);
});
