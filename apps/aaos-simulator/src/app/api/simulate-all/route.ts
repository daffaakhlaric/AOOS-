import { NextResponse, type NextRequest } from "next/server";

import {
  fetchActiveClaraPromptOverride,
  fetchListingById,
  resolveClaraPromptKeyForVertical,
  type ClaraPromptOverrideFetchResult,
} from "@/lib/aaos-api-client";
import { getJudge, toAllScenariosReportDto, toJudgementResultDto } from "@/lib/judge";
import { reportSimulationBatchToLearningSystem } from "@/lib/learning-bridge";
import { DEFAULT_SIMULATOR_CONFIG, getSimulator, toSimulationResultDto } from "@/lib/simulator";
import type { ApiErrorResponse, SimulateAllResponse } from "@/types/simulator.types";
import { SIMULATOR_VERTICALS, type SimulatorVertical } from "@aos/conversation-simulator";

const VALID_VERTICALS: ReadonlySet<string> = new Set(SIMULATOR_VERTICALS);

/**
 * `POST /api/simulate-all` (spec "API Routes"): runs all 10 personas, then judges every one,
 * returning both the per-persona pairs and the aggregate `AllScenariosReport`. See
 * `src/app/api/simulate/route.ts` for the folder-structure fix and the client/server boundary
 * this route also follows.
 *
 * This task: previously took NO request body at all (every run silently used
 * `DEFAULT_SIMULATOR_CONFIG`/`AAOS_SIMULATOR_TENANT_ID`). Now accepts an OPTIONAL JSON body —
 * `{ tenantId?, vertical?, listingId? }` — mirroring `POST /api/simulate`'s shape exactly, so the
 * batch "Jalankan Semua Skenario" flow can thread the SAME real, user-selected tenant/vertical/
 * listing through as the single-persona flow. A missing/empty body is still valid (defaults
 * unchanged, matching every pre-existing caller).
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<SimulateAllResponse | ApiErrorResponse>> {
  let body: unknown = {};
  try {
    const text = await request.text();
    body = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const requestBody = (body ?? {}) as {
    tenantId?: unknown;
    vertical?: unknown;
    listingId?: unknown;
  };

  const rawTenantId = requestBody.tenantId;
  if (rawTenantId !== undefined && (typeof rawTenantId !== "string" || rawTenantId.length === 0)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: '"tenantId" must be a non-empty string.' } },
      { status: 400 },
    );
  }
  const requestTenantId = rawTenantId as string | undefined;

  const rawVertical = requestBody.vertical;
  if (
    rawVertical !== undefined &&
    (typeof rawVertical !== "string" || !VALID_VERTICALS.has(rawVertical))
  ) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `"vertical" must be one of: ${[...VALID_VERTICALS].join(", ")}.`,
        },
      },
      { status: 400 },
    );
  }
  const vertical = (rawVertical as SimulatorVertical | undefined) ?? "AUTOMOTIVE";

  const rawListingId = requestBody.listingId;
  if (rawListingId !== undefined && typeof rawListingId !== "string") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: '"listingId" must be a string.' } },
      { status: 400 },
    );
  }
  const listingId = rawListingId as string | undefined;

  const listing =
    vertical === "PROPERTY" && listingId !== undefined && listingId.length > 0
      ? await fetchListingById(listingId)
      : undefined;

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

  // AAOS Self-Learning AI, Phase C wiring — same real-fetch, same never-throwing discipline as
  // `src/app/api/simulate/route.ts`'s identical wiring.
  //
  // Tenant resolution (this task — real tenant selector): the REQUEST's own `tenantId` now takes
  // priority; `AAOS_SIMULATOR_TENANT_ID` is kept ONLY as the fallback for a caller that sends none
  // — see that route's identical comment for the full reasoning.
  //
  // PROPERTY LLM wiring: vertical-aware, same as `POST /api/simulate` — the previous AUTOMOTIVE-only
  // short-circuit ("no LLM prompt path for PROPERTY") is OUTDATED and removed; see that route's
  // identical comment for the full reasoning.
  const promptOverrideTenantId =
    requestTenantId ?? process.env["AAOS_SIMULATOR_TENANT_ID"] ?? DEFAULT_SIMULATOR_CONFIG.tenantId;
  const promptOverrideFetch: ClaraPromptOverrideFetchResult = await fetchActiveClaraPromptOverride(
    promptOverrideTenantId,
    resolveClaraPromptKeyForVertical(vertical),
  );

  // AAOS Self-Learning AI, Phase C wiring (2nd half) — see `src/app/api/simulate/route.ts`'s
  // identical wiring for the full reasoning.
  const llmReplyEnabled = process.env["CLARA_LLM_REPLY_ENABLED"] === "true";
  const openaiApiKey = process.env["OPENAI_API_KEY"];

  const batchConfig = {
    ...DEFAULT_SIMULATOR_CONFIG,
    // Real tenant/vertical/listing threading (this task) — see `POST /api/simulate`'s identical
    // `simulationConfig` for the full reasoning.
    tenantId: promptOverrideTenantId,
    vertical,
    ...(listingId !== undefined ? { listingId } : {}),
    ...(listing !== undefined ? { listings: [listing] } : {}),
    // PROPERTY LLM wiring: route the fetched override into the field the matching
    // `ClaraSimulationComposer` branch actually reads — see `POST /api/simulate`'s identical
    // wiring for the full reasoning.
    ...(promptOverrideFetch.found
      ? vertical === "PROPERTY"
        ? { claraPropertyPromptOverride: promptOverrideFetch.content }
        : { claraPromptOverride: promptOverrideFetch.content }
      : {}),
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
  const learningBridge = await reportSimulationBatchToLearningSystem(
    reportDto,
    promptOverrideTenantId,
  );

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
