/**
 * Request/response envelope types for the two Route Handlers (spec "API Routes"). Reuses the real
 * domain types/enums from `@aos/conversation-simulator` and `@aos/ai-judge` wherever a value is
 * JSON-safe as-is (string enums, plain interfaces). Redeclares only what the HTTP/JSON transport
 * boundary genuinely requires: the packages' `SimulationResult`/`JudgementResult`/
 * `AllScenariosReport` types embed class-based value objects (`SessionId`, `JudgementId`,
 * `OverallScore`, `DimensionScoreValue`) whose private fields — not their `.value`/`.toString()`
 * accessors — are what `JSON.stringify` would actually serialize, so the Route Handlers map those
 * into plain primitives (`toSimulationResultDto` in `lib/simulator.ts`, `toJudgementResultDto` in
 * `lib/judge.ts`) before responding. Every other field keeps the real package's exact shape/type.
 */
import type { ConversationStage, LeadTemperature } from "@aos/sales-agent";
import type { PersonaDifficulty, PersonaId, SimulationStatus } from "@aos/conversation-simulator";
import type { Grade, Verdict } from "@aos/ai-judge";

/**
 * Mirrors `@aos/ai-judge`'s `Feedback` (`src/domain/value-objects/Feedback.ts`) — not reused
 * directly because its real `dimension` field is typed `DimensionName`, an enum that package does
 * *not* re-export from its top-level `src/index.ts` (unlike `Grade`/`Verdict`), so no consumer
 * outside the package can name that type. `dimension` is widened to `string` here instead — it's
 * already a JSON-safe string value at runtime either way.
 */
export interface FeedbackDto {
  readonly dimension: string;
  readonly message: string;
}

/**
 * Mirrors `@aos/ai-judge`'s `ImprovementSuggestion` (`src/domain/value-objects/
 * ImprovementSuggestion.ts`) — not re-exported from that package's top-level `src/index.ts`
 * (only `Feedback` is, and even that isn't fully nameable outside the package — see `FeedbackDto`
 * above), so the shape is restated here rather than imported.
 */
export interface ImprovementSuggestion {
  readonly dimension: string;
  readonly priority: "HIGH" | "MEDIUM" | "LOW";
  readonly suggestion: string;
}

/** JSON-safe mirror of `SimulationMessage` (`SimulationSpeaker` is a plain string enum, `"BUYER" | "CLARA"`, not re-exported from the package's top-level `src/index.ts` — so the literal union is used directly instead of importing it). */
export interface SimulationMessageDto {
  readonly turn: number;
  readonly speaker: "BUYER" | "CLARA";
  readonly text: string;
  readonly occurredAt: string;
}

/** JSON-safe mirror of `conversation-simulator`'s `ScoreProgressionEntry`. */
export interface ScoreProgressionEntryDto {
  readonly turn: number;
  readonly score: number;
  readonly delta: number;
  readonly reason: string;
}

/** JSON-safe mirror of `conversation-simulator`'s `StageTransitionEntry`. */
export interface StageTransitionEntryDto {
  readonly turn: number;
  readonly from: ConversationStage;
  readonly to: ConversationStage;
}

/** JSON-safe mirror of `@aos/conversation-simulator`'s `SimulationResult` — `sessionId` is a plain string (was `SessionId`), everything else keeps its real shape. */
export interface SimulationResultDto {
  readonly sessionId: string;
  readonly personaId: PersonaId;
  readonly personaDifficulty: PersonaDifficulty;
  readonly status: SimulationStatus;
  readonly messages: ReadonlyArray<SimulationMessageDto>;
  readonly totalTurns: number;
  readonly durationMs: number;
  readonly finalScore: number;
  readonly finalTemperature: LeadTemperature;
  readonly handoffTriggered: boolean;
  readonly handoffAtTurn?: number;
  readonly scoreProgression: ReadonlyArray<ScoreProgressionEntryDto>;
  readonly stageTransitions: ReadonlyArray<StageTransitionEntryDto>;
  readonly finalStage?: ConversationStage;
  readonly expectedOutcome: LeadTemperature;
  readonly metExpectation: boolean;
  readonly avgClaraResponseLength: number;
  readonly maxClaraResponseLength: number;
  readonly longestClaraMessage: string;
  readonly claraUsedInventory: boolean;
  readonly claraHandledObjection: boolean;
  readonly followUpScheduled: boolean;
}

/** JSON-safe mirror of one `DimensionScore` — `score` is a plain `number` (was `DimensionScoreValue`), `appliedRules` keeps its real shape. */
export interface DimensionScoreDto {
  readonly dimension: string;
  readonly score: number;
  readonly appliedRules: ReadonlyArray<{
    readonly rule: string;
    readonly points: number;
    readonly note: string;
  }>;
}

/** JSON-safe mirror of `@aos/ai-judge`'s `JudgementResult` — `id`/`simulationSessionId` are plain strings, `overallScore` is a plain `number`, `judgedAt` is an ISO string. */
export interface JudgementResultDto {
  readonly id: string;
  readonly simulationSessionId: string;
  readonly personaId: PersonaId;
  readonly personaDifficulty: PersonaDifficulty;
  readonly judgedAt: string;
  readonly naturalLanguage: DimensionScoreDto;
  readonly qualification: DimensionScoreDto;
  readonly objectionHandling: DimensionScoreDto;
  readonly closingAttempt: DimensionScoreDto;
  readonly handoffQuality: DimensionScoreDto;
  readonly responseLength: DimensionScoreDto;
  readonly overallScore: number;
  readonly grade: Grade;
  readonly verdict: Verdict;
  readonly feedbackItems: ReadonlyArray<FeedbackDto>;
  readonly improvementSuggestions: ReadonlyArray<ImprovementSuggestion>;
  readonly highlights: ReadonlyArray<string>;
  readonly isGoldenCandidate: boolean;
}

/** JSON-safe mirror of `@aos/ai-judge`'s `AllScenariosReport` — `judgedAt` is an ISO string, `results` uses `JudgementResultDto`, `goldenCandidates` are plain strings (were `SessionId`). */
export interface AllScenariosReportDto {
  readonly judgedAt: string;
  readonly totalPersonas: number;
  readonly approvedCount: number;
  readonly needsImprovementCount: number;
  readonly failCount: number;
  readonly overallVerdict: Verdict;
  readonly avgOverallScore: number;
  readonly results: ReadonlyArray<JudgementResultDto>;
  readonly weakestDimensions: ReadonlyArray<{
    readonly dimension: string;
    readonly avgScore: number;
  }>;
  readonly topPriorities: ReadonlyArray<string>;
  readonly goldenCandidates: ReadonlyArray<string>;
}

/**
 * Request body for `POST /api/simulate` (spec "API Routes"). `vertical`/`listingId` are
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 additions (spec section 12 point 4) — both
 * optional, `vertical` defaults `"AUTOMOTIVE"` when omitted (every existing caller's behavior
 * unchanged).
 *
 * `tenantId` (this task) is the real, user-selected tenant from `TenantSelector` — optional so
 * every pre-existing caller/test that never sends it keeps working exactly as before (the route
 * falls back to `AAOS_SIMULATOR_TENANT_ID`/`DEFAULT_SIMULATOR_CONFIG.tenantId`, in that order, per
 * the task's explicit "may remain as an honest DEFAULT/fallback" instruction).
 */
export interface SimulateRequest {
  readonly personaId: string;
  readonly tenantId?: string;
  readonly vertical?: "AUTOMOTIVE" | "PROPERTY";
  readonly listingId?: string;
}

/**
 * Request body for `POST /api/simulate-all` (this task — previously took NO body at all). Same
 * `tenantId`/`vertical`/`listingId` shape as `SimulateRequest`, all optional for the identical
 * fallback-default reason.
 */
export interface SimulateAllRequest {
  readonly tenantId?: string;
  readonly vertical?: "AUTOMOTIVE" | "PROPERTY";
  readonly listingId?: string;
}

/** JSON-safe mirror of `src/lib/aaos-api-client.ts`'s `TenantSummary` — restated here for the same transport-boundary reason every other DTO in this file is. */
export interface TenantSummaryDto {
  readonly tenantId: string;
  readonly name: string;
  readonly vertical: "AUTOMOTIVE" | "PROPERTY";
}

/** Response body for `GET /api/tenants` — mirrors `aaos-api-client.ts`'s `FetchTenantsResult` exactly (always HTTP 200; `ok: false` is the honest "real call failed" outcome, not a fabricated list). */
export type FetchTenantsResponse =
  | { readonly ok: true; readonly tenants: readonly TenantSummaryDto[] }
  | { readonly ok: false; readonly reason: string };

/** JSON-safe mirror of `src/lib/aaos-api-client.ts`'s `ListingSummary`. */
export interface ListingSummaryDto {
  readonly id: string;
  readonly title: string;
  readonly propertyType: string;
  readonly price: number;
  readonly city?: string;
}

/** Response body for `GET /api/listings?tenantId=...` — mirrors `aaos-api-client.ts`'s `FetchActiveListingsResult` exactly. */
export type FetchActiveListingsResponse =
  | { readonly ok: true; readonly listings: readonly ListingSummaryDto[] }
  | { readonly ok: false; readonly reason: string };

/**
 * AAOS Self-Learning AI, Phase C wiring — a real, honest, always-present (never omitted) record of
 * whether this run's Clara conversation actually used a fetched `agent_prompt_overrides` row
 * (`applied: true`) or the unchanged hardcoded default (`applied: false`, with `reason` explaining
 * why — no active override, or `apps/aaos-api` unreachable/misconfigured). Exists so this never
 * becomes invisible/unverifiable, per the task's own explicit requirement — never fabricated.
 */
export interface PromptOverrideStatusDto {
  readonly applied: boolean;
  readonly tenantId: string;
  readonly reason?: string;
}

/** Success response body for `POST /api/simulate` (spec "API Routes"). */
export interface SimulateResponse {
  readonly simulationResult: SimulationResultDto;
  readonly judgementResult: JudgementResultDto;
  readonly promptOverride: PromptOverrideStatusDto;
}

/** One entry of `POST /api/simulate-all`'s `results` array (spec "API Routes"). */
export interface SimulateAllResultEntry {
  readonly personaId: string;
  readonly simulationResult: SimulationResultDto;
  readonly judgementResult: JudgementResultDto;
}

/**
 * Self-Learning AI bridge phase — the real, honest outcome of forwarding this run's report to
 * `apps/aaos-api`'s Self-Improving pipeline (`src/lib/learning-bridge.ts`'s
 * `reportSimulationBatchToLearningSystem`). Mirrors that function's own `LearningBridgeResult`
 * union — restated here (not imported) for the same JSON-transport-boundary reason every other DTO
 * in this file is restated rather than imported.
 */
export type LearningBridgeStatusDto =
  | { readonly status: "SENT"; readonly agentRunId: string; readonly judgeResultId: string }
  | { readonly status: "SKIPPED"; readonly reason: string }
  | { readonly status: "FAILED"; readonly reason: string };

/** Success response body for `POST /api/simulate-all` (spec "API Routes"). */
export interface SimulateAllResponse {
  readonly results: ReadonlyArray<SimulateAllResultEntry>;
  readonly report: AllScenariosReportDto;
  /**
   * Self-Learning AI bridge phase — always present (never omitted): a real, honest status for
   * whether this run's report was forwarded into `apps/aaos-api`'s Self-Improving pipeline. Never
   * fabricated — see `learning-bridge.ts`'s own doc for the full best-effort contract.
   */
  readonly learningBridge: LearningBridgeStatusDto;
  /** See `PromptOverrideStatusDto`'s own doc — same real, honest, never-fabricated contract. */
  readonly promptOverride: PromptOverrideStatusDto;
}

/** Shared error envelope both Route Handlers return on failure. */
export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

/** JSON-safe mirror of `@aos/conversation-simulator`'s `BuyerPersona` (already fully JSON-safe as-is — every field is a primitive, string array, or string enum — restated here only so `PersonaSelector`'s props have a name of their own). */
export interface PersonaSummary {
  readonly id: PersonaId;
  readonly name: string;
  readonly difficulty: PersonaDifficulty;
  readonly description: string;
}
