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

/** JSON-safe mirror of `SimulationMessage` (`SimulationSpeaker` is a plain string enum, `"BUYER" | "JESSY"`, not re-exported from the package's top-level `src/index.ts` — so the literal union is used directly instead of importing it). */
export interface SimulationMessageDto {
  readonly turn: number;
  readonly speaker: "BUYER" | "JESSY";
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
  readonly avgJessyResponseLength: number;
  readonly maxJessyResponseLength: number;
  readonly longestJessyMessage: string;
  readonly jessyUsedInventory: boolean;
  readonly jessyHandledObjection: boolean;
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
 */
export interface SimulateRequest {
  readonly personaId: string;
  readonly vertical?: "AUTOMOTIVE" | "PROPERTY";
  readonly listingId?: string;
}

/** Success response body for `POST /api/simulate` (spec "API Routes"). */
export interface SimulateResponse {
  readonly simulationResult: SimulationResultDto;
  readonly judgementResult: JudgementResultDto;
}

/** One entry of `POST /api/simulate-all`'s `results` array (spec "API Routes"). */
export interface SimulateAllResultEntry {
  readonly personaId: string;
  readonly simulationResult: SimulationResultDto;
  readonly judgementResult: JudgementResultDto;
}

/** Success response body for `POST /api/simulate-all` (spec "API Routes"). */
export interface SimulateAllResponse {
  readonly results: ReadonlyArray<SimulateAllResultEntry>;
  readonly report: AllScenariosReportDto;
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
