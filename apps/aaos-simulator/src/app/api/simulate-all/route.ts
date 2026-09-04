import { NextResponse } from "next/server";

import { fetchActiveClaraPromptOverride } from "@/lib/aaos-api-client";
import { getJudge, toAllScenariosReportDto, toJudgementResultDto } from "@/lib/judge";
import { reportSimulationBatchToLearningSystem } from "@/lib/learning-bridge";
import { DEFAULT_SIMULATOR_CONFIG, getSimulator, toSimulationResultDto } from "@/lib/simulator";
import type { ApiErrorResponse, SimulateAllResponse } from "@/types/simulator.types";

/**
 * `POST /api/simulate-all` (spec "API Routes"): runs all 10 personas, then judges every one,
 * returning both the per-persona pairs and the aggregate `AllScenariosReport`. See
 * `src/app/api/simulate/route.ts` for the folder-structure fix and the client/server boundary
 * this route also follows.
 */
export async function POST(): Promise<NextResponse<SimulateAllResponse | ApiErrorResponse>> {
  const simulatorResult = getSimulator();
  /* v8 ignore start -- unreachable in practice: see `src/app/api/simulate/route.ts`'s identical
     `getSimulator()` guard for why `SimulatorFactory.create()` cannot realistically fail here. */
  if (!simulatorResult.ok) {
    return NextResponse.json(
      { error: { code: simulatorResult.error.code, message: simulatorResult.error.message } },
      { status: 500 },
    );
  }
  /* v8 ignore stop */

  // AAOS Self-Learning AI, Phase C wiring — same real-fetch, same tenant resolution, same
  // never-throwing discipline as `src/app/api/simulate/route.ts`'s identical wiring.
  const promptOverrideTenantId =
    process.env["AAOS_SIMULATOR_TENANT_ID"] ?? DEFAULT_SIMULATOR_CONFIG.tenantId;
  const promptOverrideFetch = await fetchActiveClaraPromptOverride(promptOverrideTenantId);

  // AAOS Self-Learning AI, Phase C wiring (2nd half) — see `src/app/api/simulate/route.ts`'s
  // identical wiring for the full reasoning.
  const llmReplyEnabled = process.env["CLARA_LLM_REPLY_ENABLED"] === "true";
  const openaiApiKey = process.env["OPENAI_API_KEY"];

  const batchConfig = {
    ...DEFAULT_SIMULATOR_CONFIG,
    ...(promptOverrideFetch.found ? { claraPromptOverride: promptOverrideFetch.content } : {}),
    ...(llmReplyEnabled ? { llmReplyEnabled } : {}),
    ...(openaiApiKey !== undefined && openaiApiKey.length > 0 ? { openaiApiKey } : {}),
  };

  const simulationsOutcome = await simulatorResult.value.runAllScenarios.execute(batchConfig);
  /* v8 ignore start -- unreachable in practice: `RunAllScenarios.execute` itself converts any
     single persona's `RunSimulation` failure into a synthesized `FAILED`-status result rather than
     aborting the batch (`@aos/conversation-simulator`'s own design) — it only returns `err` if
     `PersonaRegistry.get` fails for one of its own hardcoded `ALL_PERSONA_IDS`, which cannot
     happen (see that package's own "unreachable in practice" note on the same check). */
  if (!simulationsOutcome.ok) {
    return NextResponse.json(
      { error: { code: simulationsOutcome.error.code, message: simulationsOutcome.error.message } },
      { status: 500 },
    );
  }
  /* v8 ignore stop */

  const judgeResult = getJudge();
  /* v8 ignore start -- unreachable in practice: see `src/app/api/simulate/route.ts`'s identical
     `getJudge()` guard. */
  if (!judgeResult.ok) {
    return NextResponse.json(
      { error: { code: judgeResult.error.code, message: judgeResult.error.message } },
      { status: 500 },
    );
  }
  /* v8 ignore stop */

  const reportOutcome = await judgeResult.value.judgeAllScenarios.execute(simulationsOutcome.value);
  /* v8 ignore start -- unreachable in practice: `JudgeAllScenarios.execute` only returns `err` if
     `JudgeConversation.execute` does for one of its 10 entries, which (per
     `src/app/api/simulate/route.ts`'s identical guard) requires an empty `messages` array — never
     produced by any of the 10 real personas' completed simulations. */
  if (!reportOutcome.ok) {
    return NextResponse.json(
      { error: { code: reportOutcome.error.code, message: reportOutcome.error.message } },
      { status: 500 },
    );
  }
  /* v8 ignore stop */

  const results = simulationsOutcome.value.map((simulationResult, index) => {
    const judgementResult = reportOutcome.value.results[index];
    /* v8 ignore start -- unreachable in practice: `JudgeAllScenarios.execute` judges every entry
       of the array it's given, in order, so `reportOutcome.value.results` always has exactly the
       same length as `simulationsOutcome.value`. */
    if (!judgementResult) {
      throw new Error(`Missing judgement result for simulation at index ${index}`);
    }
    /* v8 ignore stop */
    return {
      personaId: simulationResult.personaId,
      simulationResult: toSimulationResultDto(simulationResult),
      judgementResult: toJudgementResultDto(judgementResult),
    };
  });

  const reportDto = toAllScenariosReportDto(reportOutcome.value);

  // Self-Learning AI bridge phase — real, best-effort forward into `apps/aaos-api`'s existing
  // Self-Improving pipeline. Never throws (see `learning-bridge.ts`'s own doc for the full
  // contract), so this can never turn the real, already-succeeded simulation above into a failed
  // response — the caller always gets its real report either way.
  const learningBridge = await reportSimulationBatchToLearningSystem(reportDto);

  return NextResponse.json(
    {
      results,
      report: reportDto,
      learningBridge,
      promptOverride: {
        applied: promptOverrideFetch.found,
        tenantId: promptOverrideTenantId,
        ...(promptOverrideFetch.found ? {} : { reason: promptOverrideFetch.reason }),
      },
    },
    { status: 200 },
  );
}
