import {
  PersonaId,
  SIMULATOR_VERTICALS,
  type SimulatorVertical,
} from "@aos/conversation-simulator";
import { NextResponse, type NextRequest } from "next/server";

import {
  fetchActiveClaraPromptOverride,
  fetchListingById,
  resolveClaraPromptKeyForVertical,
} from "@/lib/aaos-api-client";
import { getJudge, toJudgementResultDto } from "@/lib/judge";
import { DEFAULT_SIMULATOR_CONFIG, getSimulator, toSimulationResultDto } from "@/lib/simulator";
import type { ApiErrorResponse, SimulateRequest, SimulateResponse } from "@/types/simulator.types";

/**
 * `ALL_PERSONA_IDS` (the package's canonical id-order list) is not re-exported from
 * `@aos/conversation-simulator`'s top-level `src/index.ts` — only the `PersonaId` enum itself is.
 * `PersonaId` is a plain string enum, so `Object.values` recovers the same 10 ids losslessly.
 */
const VALID_PERSONA_IDS: ReadonlySet<string> = new Set(Object.values(PersonaId));

/** AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 — `SIMULATOR_VERTICALS` IS re-exported from `@aos/conversation-simulator`'s top-level `src/index.ts` (unlike `ALL_PERSONA_IDS` above), so no `Object.values`-style workaround is needed here. */
const VALID_VERTICALS: ReadonlySet<string> = new Set(SIMULATOR_VERTICALS);

/**
 * `POST /api/simulate` (spec "API Routes"): runs one persona's simulation, then judges it — both
 * `@aos/conversation-simulator` and `@aos/ai-judge` are Node-only server-side business logic
 * (design resolution #5), so this Route Handler is the only place either package is imported and
 * invoked; client components only ever `fetch` this URL and render the JSON response.
 *
 * Folder-structure fix (documented in README.md): the spec's ASCII tree lists this file at
 * `src/api/simulate/route.ts`, a sibling of `src/app/`. Next.js App Router route handlers are only
 * recognized inside the `app/` tree, so the working location is `src/app/api/simulate/route.ts`.
 *
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 (spec section 12 point 4) — the request body now
 * also accepts an optional `vertical` (defaults `"AUTOMOTIVE"`, every existing caller's behavior
 * unchanged) and `listingId`. `getSimulator()`'s `cachedSimulator` is composed ONCE at module load
 * and reused for every request, so `vertical`/`listingId`/the real fetched `listings` MUST flow
 * through this per-call `config` object passed to `runSimulation.execute`, never through
 * `SimulatorFactory.create()` itself (which stays call-independent).
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

  const requestBody = body as { tenantId?: unknown; vertical?: unknown; listingId?: unknown };

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

  // AAOS Self-Learning AI, Phase C wiring — real-fetch the tenant's currently-active Clara
  // system-prompt override before composing (best-effort, never throws — see
  // `fetchActiveClaraPromptOverride`'s own doc).
  //
  // Tenant resolution (this task — real tenant selector): the REQUEST's own `tenantId` (from the
  // UI's real `TenantSelector`, sourced from `apps/aaos-api`'s real tenant list) now takes
  // priority. `AAOS_SIMULATOR_TENANT_ID` is kept ONLY as the fallback for a caller that sends no
  // `tenantId` at all (an unselected/legacy caller — e.g. a direct API caller, or a test), per the
  // task's explicit "may remain as an honest DEFAULT/fallback value" instruction — it must never
  // again be the ONLY real value ever used.
  //
  // PROPERTY LLM wiring: vertical-aware — resolves `clara_property_system_prompt` for PROPERTY,
  // `clara_system_prompt` for AUTOMOTIVE (`resolveClaraPromptKeyForVertical`), and always performs
  // the real fetch. The previous "PROPERTY vertical has no LLM prompt path" short-circuit is
  // OUTDATED now that `@aos/sales-agent`'s `createPropertyConversationEngine` has a real LLM
  // call site — removed.
  const promptOverrideTenantId =
    requestTenantId ?? process.env["AAOS_SIMULATOR_TENANT_ID"] ?? DEFAULT_SIMULATOR_CONFIG.tenantId;
  const promptOverrideFetch = await fetchActiveClaraPromptOverride(
    promptOverrideTenantId,
    resolveClaraPromptKeyForVertical(vertical),
  );

  // AAOS Self-Learning AI, Phase C wiring (2nd half) — real thread of `CLARA_LLM_REPLY_ENABLED`/
  // `OPENAI_API_KEY` from this app's own env into `SimulatorConfig`. Left unset,
  // `SimulatorConfigSchema` leaves `llmReplyEnabled` undefined, `SalesAgentConfigSchema` then
  // defaults it `false` — today's unchanged rule-based behavior, same never-silently-broken
  // discipline `SalesAgentConfig.openaiApiKey`'s own doc already requires (an accidental `true`
  // with no real key never wires the LLM generator regardless).
  const llmReplyEnabled = process.env["CLARA_LLM_REPLY_ENABLED"] === "true";
  const openaiApiKey = process.env["OPENAI_API_KEY"];

  const simulationConfig = {
    ...DEFAULT_SIMULATOR_CONFIG,
    // Real tenant threading (this task): `SimulatorConfig.tenantId` drives
    // `@aos/sales-agent`/`@aos/branch-manager`'s real use cases (see that package's own doc) — it
    // must reflect the REQUEST's resolved tenant, same as `promptOverrideTenantId` above, not stay
    // hardcoded at `DEFAULT_SIMULATOR_CONFIG.tenantId` ("tenant-dss-motor") for every run.
    tenantId: promptOverrideTenantId,
    vertical,
    ...(listingId !== undefined ? { listingId } : {}),
    ...(listing !== undefined ? { listings: [listing] } : {}),
    // PROPERTY LLM wiring: route the fetched override into the field the matching
    // `ClaraSimulationComposer` branch actually reads — `claraPromptOverride` (AUTOMOTIVE) vs
    // `claraPropertyPromptOverride` (PROPERTY).
    ...(promptOverrideFetch.found
      ? vertical === "PROPERTY"
        ? { claraPropertyPromptOverride: promptOverrideFetch.content }
        : { claraPromptOverride: promptOverrideFetch.content }
      : {}),
    ...(llmReplyEnabled ? { llmReplyEnabled } : {}),
    ...(openaiApiKey !== undefined && openaiApiKey.length > 0 ? { openaiApiKey } : {}),
  };

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
    simulationConfig,
  );
  /* v8 ignore start -- unreachable in practice: `personaId` is already validated against
     `VALID_PERSONA_IDS` above and `DEFAULT_SIMULATOR_CONFIG` is a valid, pre-parsed
     `SimulatorConfig`, so `RunSimulation.execute` only returns `err` for a thrown/unexpected
     failure from Clara's own use cases (`@aos/conversation-simulator`'s own design resolution
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
      promptOverride: {
        applied: promptOverrideFetch.found,
        tenantId: promptOverrideTenantId,
        ...(promptOverrideFetch.found ? {} : { reason: promptOverrideFetch.reason }),
      },
    },
    { status: 200 },
  );
}
