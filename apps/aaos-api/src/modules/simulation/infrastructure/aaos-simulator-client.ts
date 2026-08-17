import { z } from "zod";

/**
 * HTTP client for the real, already-deployed sibling app `apps/aaos-simulator`'s
 * `POST /api/simulate` (coordinator note #3) — runs one `PersonaId`'s Jessy conversation
 * simulation, then judges it via `@aos/ai-judge`, both for real (no LLM cost — `@aos/
 * conversation-simulator`'s personas are fixed, deterministic scripts; see that route's own
 * docstring).
 *
 * Deliberately validated with a local Zod schema rather than importing `apps/aaos-simulator`'s
 * own `SimulateResponse` type: these are two separate deployable apps talking over HTTP, not two
 * modules of one process — the contract is the JSON wire shape, not a shared TS type. Only the
 * subset of fields `domain/scoring.ts`/the dashboard status DTO actually need is picked out; the
 * upstream response has more (full message transcript, score progression, etc.) that this dry-run
 * summary view doesn't surface today.
 *
 * `apps/aaos-simulator` has no `x-api-key`/auth guard on `/api/simulate` (verified against its
 * real route handler) — this is an internal-network call, no auth header sent.
 */

const AaosSimulatorResponseSchema = z.object({
  simulationResult: z.object({
    finalScore: z.number(),
    finalTemperature: z.string(),
    handoffTriggered: z.boolean(),
    totalTurns: z.number(),
  }),
  judgementResult: z.object({
    overallScore: z.number(),
    grade: z.string(),
    verdict: z.string(),
    feedbackItems: z.array(z.object({ dimension: z.string(), message: z.string() })),
  }),
});

export interface AaosSimulatorRunResult {
  readonly finalScore: number;
  readonly finalTemperature: string;
  readonly handoffTriggered: boolean;
  readonly totalTurns: number;
  readonly overallScore: number;
  readonly grade: string;
  readonly verdict: string;
  readonly feedbackItems: ReadonlyArray<{ readonly dimension: string; readonly message: string }>;
}

export class AaosSimulatorError extends Error {}

/**
 * Calls `${baseUrl}/api/simulate` with `{ personaId }`. Throws `AaosSimulatorError` (never a raw
 * fetch rejection) on a non-2xx response, a network failure, or a response that fails the Zod
 * shape check — the caller (`SimulationService`) turns that into an honest `ok: false` per-persona
 * result, never a fabricated success.
 */
export async function callAaosSimulator(
  baseUrl: string,
  personaId: string,
): Promise<AaosSimulatorRunResult> {
  let response: Response;
  try {
    response = await fetch(new URL("/api/simulate", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personaId }),
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new AaosSimulatorError(`aaos-simulator request failed: ${message}`);
  }

  const text = await response.text();
  const parsedJson: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new AaosSimulatorError(
      `aaos-simulator /api/simulate responded ${response.status} for personaId "${personaId}"`,
    );
  }

  const validated = AaosSimulatorResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AaosSimulatorError(
      `aaos-simulator /api/simulate returned an unexpected response shape for personaId "${personaId}"`,
    );
  }

  return {
    finalScore: validated.data.simulationResult.finalScore,
    finalTemperature: validated.data.simulationResult.finalTemperature,
    handoffTriggered: validated.data.simulationResult.handoffTriggered,
    totalTurns: validated.data.simulationResult.totalTurns,
    overallScore: validated.data.judgementResult.overallScore,
    grade: validated.data.judgementResult.grade,
    verdict: validated.data.judgementResult.verdict,
    feedbackItems: validated.data.judgementResult.feedbackItems,
  };
}
