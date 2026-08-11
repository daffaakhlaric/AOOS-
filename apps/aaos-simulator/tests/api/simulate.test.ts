import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

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
