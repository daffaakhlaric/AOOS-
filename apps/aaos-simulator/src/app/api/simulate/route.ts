import { PersonaId } from "@aos/conversation-simulator";
import { NextResponse, type NextRequest } from "next/server";

import { getJudge, toJudgementResultDto } from "@/lib/judge";
import { DEFAULT_SIMULATOR_CONFIG, getSimulator, toSimulationResultDto } from "@/lib/simulator";
import type { ApiErrorResponse, SimulateRequest, SimulateResponse } from "@/types/simulator.types";

/**
 * `ALL_PERSONA_IDS` (the package's canonical id-order list) is not re-exported from
 * `@aos/conversation-simulator`'s top-level `src/index.ts` — only the `PersonaId` enum itself is.
 * `PersonaId` is a plain string enum, so `Object.values` recovers the same 10 ids losslessly.
 */
const VALID_PERSONA_IDS: ReadonlySet<string> = new Set(Object.values(PersonaId));

/**
 * `POST /api/simulate` (spec "API Routes"): runs one persona's simulation, then judges it — both
 * `@aos/conversation-simulator` and `@aos/ai-judge` are Node-only server-side business logic
 * (design resolution #5), so this Route Handler is the only place either package is imported and
 * invoked; client components only ever `fetch` this URL and render the JSON response.
 *
 * Folder-structure fix (documented in README.md): the spec's ASCII tree lists this file at
 * `src/api/simulate/route.ts`, a sibling of `src/app/`. Next.js App Router route handlers are only
 * recognized inside the `app/` tree, so the working location is `src/app/api/simulate/route.ts`.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SimulateResponse | ApiErrorResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const personaId = (body as Partial<SimulateRequest> | null)?.personaId;
  if (typeof personaId !== "string" || !VALID_PERSONA_IDS.has(personaId)) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `"personaId" must be one of: ${[...VALID_PERSONA_IDS].join(", ")}.`,
        },
      },
      { status: 400 },
    );
  }

  const simulatorResult = getSimulator();
  /* v8 ignore start -- unreachable in practice: `SimulatorFactory.create()` only ever fails if one
     of the 10 hardcoded persona literals in `@aos/conversation-simulator` becomes malformed (see
     that package's own `SimulatorFactory` — the same "unreachable" judgment call it makes for its
     analogous `PersonaRegistry.create()` guard). Kept as a live `Result` check, not asserted away,
     because `getSimulator()`'s return type is `Result<Simulator, SimulatorError>` and this route
     must handle both branches to stay type-correct without an unsafe cast. */
  if (!simulatorResult.ok) {
    return NextResponse.json(
      { error: { code: simulatorResult.error.code, message: simulatorResult.error.message } },
      { status: 500 },
    );
  }
  /* v8 ignore stop */

  const simulationOutcome = await simulatorResult.value.runSimulation.execute(
    personaId as PersonaId,
    DEFAULT_SIMULATOR_CONFIG,
  );
  /* v8 ignore start -- unreachable in practice: `personaId` is already validated against
     `VALID_PERSONA_IDS` above and `DEFAULT_SIMULATOR_CONFIG` is a valid, pre-parsed
     `SimulatorConfig`, so `RunSimulation.execute` only returns `err` for a thrown/unexpected
     failure from Jessy's own use cases (`@aos/conversation-simulator`'s own design resolution
     #2d) — not exercised by any of the 10 real personas' fixed scripts today. */
  if (!simulationOutcome.ok) {
    return NextResponse.json(
      { error: { code: simulationOutcome.error.code, message: simulationOutcome.error.message } },
      { status: 500 },
    );
  }
  /* v8 ignore stop */

  const judgeResult = getJudge();
  /* v8 ignore start -- unreachable in practice: `AiJudgeFactory.create()` only ever fails on an
     invalid config, and this route always calls it with no overrides (`DEFAULT_AI_JUDGE_CONFIG`). */
  if (!judgeResult.ok) {
    return NextResponse.json(
      { error: { code: judgeResult.error.code, message: judgeResult.error.message } },
      { status: 500 },
    );
  }
  /* v8 ignore stop */

  const judgementOutcome = await judgeResult.value.judgeConversation.execute(
    simulationOutcome.value,
  );
  /* v8 ignore start -- unreachable in practice: `JudgeConversation.execute` only returns `err`
     when `simulationResult.messages` is empty, and every real, completed `SimulationResult` from
     `RunSimulation` above has at least one message. */
  if (!judgementOutcome.ok) {
    return NextResponse.json(
      { error: { code: judgementOutcome.error.code, message: judgementOutcome.error.message } },
      { status: 500 },
    );
  }
  /* v8 ignore stop */

  return NextResponse.json(
    {
      simulationResult: toSimulationResultDto(simulationOutcome.value),
      judgementResult: toJudgementResultDto(judgementOutcome.value),
    },
    { status: 200 },
  );
}
