import type { AllScenariosReportDto } from "@/types/simulator.types";

/**
 * Self-Learning AI bridge phase — the real bridge from this app's `POST /api/simulate-all` into
 * `apps/aaos-api`'s existing Self-Improving pipeline (`AiJudgeService.ingestSimulationBatch` ->
 * `LearningService.onAgentRunJudged` -> the SAME auto-apply machinery every other real judged run
 * already triggers, per the standing "no human approval gate" decision).
 *
 * Mirrors `src/lib/aaos-api-client.ts`'s existing `fetchListingById` convention exactly: same
 * `AAOS_API_BASE_URL`/`AAOS_API_KEY`/`x-api-key` header convention, same "never throws" contract —
 * a missing/misconfigured env var, a network failure, a timeout, or a non-2xx response from
 * `apps/aaos-api` all resolve to an honest `{ status: "SKIPPED" | "FAILED", ... }` result, NEVER a
 * thrown error, so a bridge failure can never turn a successful simulate-all run into a failed
 * request (coordinator note's explicit "never let this bridge turn a successful simulation into a
 * failed request").
 *
 * TENANT RESOLUTION (real investigation finding, restated from `.env.example`'s own doc): this app
 * has zero tenant concept of its own. `AAOS_SIMULATOR_TENANT_ID` is optional — when unset, no
 * `x-tenant-id` header is sent at all, and `apps/aaos-api`'s own `DEFAULT_TENANT_ID` ("dss-motor")
 * resolution applies, the same real single-tenant default every pre-existing table in that app
 * already falls back to. No new auth/session/tenant mechanism was invented for this bridge.
 *
 * SYNCHRONOUS, NOT DETACHED (a deliberate, documented departure from the coordinator note's own
 * "fire-and-forget... mirroring the `closings.service.ts` `.catch()` pattern" wording, chosen after
 * reading that pattern's real shape): `closings.service.ts` fires `judgeRun` truly detached because
 * its caller (a sales human clicking "record closing") has no UI slot waiting to show a judge
 * result. `/report`'s own coordinator note explicitly requires showing "an honest real status" on
 * the SAME page load — `{ sent: true } | { sent: false }` cannot be known without awaiting the call
 * at least once. This function is therefore awaited by `POST /api/simulate-all`'s route handler,
 * but bounded by an 8s timeout and wrapped so it can NEVER throw/reject — functionally identical
 * "best-effort, never blocks or fails the real request" discipline, just synchronous rather than
 * literally unawaited. If this distinction matters for a future caller that truly cannot wait,
 * that caller should call this function without awaiting it — nothing here requires awaiting.
 */

const BRIDGE_TIMEOUT_MS = 8_000;

export type LearningBridgeResult =
  | { readonly status: "SENT"; readonly agentRunId: string; readonly judgeResultId: string }
  | { readonly status: "SKIPPED"; readonly reason: string }
  | { readonly status: "FAILED"; readonly reason: string };

interface IngestSimulationBatchResponse {
  readonly agentRunId: string;
  readonly judgeResultId: string;
}

function isIngestSimulationBatchResponse(value: unknown): value is IngestSimulationBatchResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<IngestSimulationBatchResponse>).agentRunId === "string" &&
    typeof (value as Partial<IngestSimulationBatchResponse>).judgeResultId === "string"
  );
}

/** Trims `AllScenariosReportDto` (already JSON-safe) into the exact real body `apps/aaos-api`'s `IngestSimulationBatchBodySchema` validates — same real field names, no re-derivation. */
function toRequestBody(report: AllScenariosReportDto): Record<string, unknown> {
  return {
    judgedAt: report.judgedAt,
    totalPersonas: report.totalPersonas,
    approvedCount: report.approvedCount,
    needsImprovementCount: report.needsImprovementCount,
    failCount: report.failCount,
    overallVerdict: report.overallVerdict,
    avgOverallScore: report.avgOverallScore,
    weakestDimensions: report.weakestDimensions,
    topPriorities: report.topPriorities,
    results: report.results.map((r) => ({
      personaId: r.personaId,
      personaDifficulty: r.personaDifficulty,
      grade: r.grade,
      verdict: r.verdict,
      overallScore: r.overallScore,
      naturalLanguage: r.naturalLanguage.score,
      qualification: r.qualification.score,
      objectionHandling: r.objectionHandling.score,
      closingAttempt: r.closingAttempt.score,
      handoffQuality: r.handoffQuality.score,
      responseLength: r.responseLength.score,
      highlights: r.highlights,
      improvementSuggestions: r.improvementSuggestions,
    })),
  };
}

/**
 * Sends this run's real `AllScenariosReportDto` to `apps/aaos-api`'s
 * `POST /api/v1/ai-judge/simulation-batch`. Never throws — see class-level doc.
 */
export async function reportSimulationBatchToLearningSystem(
  report: AllScenariosReportDto,
): Promise<LearningBridgeResult> {
  const baseUrl = process.env["AAOS_API_BASE_URL"];
  const apiKey = process.env["AAOS_API_KEY"];
  if (
    baseUrl === undefined ||
    baseUrl.length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0
  ) {
    return {
      status: "SKIPPED",
      reason: "AAOS_API_BASE_URL/AAOS_API_KEY belum dikonfigurasi di aaos-simulator.",
    };
  }

  const tenantId = process.env["AAOS_SIMULATOR_TENANT_ID"];
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "content-type": "application/json",
  };
  if (tenantId !== undefined && tenantId.length > 0) {
    headers["x-tenant-id"] = tenantId;
  }

  let response: Response;
  try {
    response = await fetch(new URL("/api/v1/ai-judge/simulation-batch", baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(toRequestBody(report)),
      cache: "no-store",
      signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
    });
  } catch (caught) {
    return {
      status: "FAILED",
      reason: `Gagal terhubung ke aaos-api: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }

  let data: unknown;
  try {
    const text = await response.text();
    data = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    return {
      status: "FAILED",
      reason: `aaos-api mengembalikan body non-JSON (status ${String(response.status)}).`,
    };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : `aaos-api merespons status ${String(response.status)}`;
    return { status: "FAILED", reason: message };
  }

  if (!isIngestSimulationBatchResponse(data)) {
    return {
      status: "FAILED",
      reason: "aaos-api merespons 2xx tapi body tidak sesuai bentuk yang diharapkan.",
    };
  }

  return { status: "SENT", agentRunId: data.agentRunId, judgeResultId: data.judgeResultId };
}
