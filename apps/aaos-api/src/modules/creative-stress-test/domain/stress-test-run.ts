/**
 * Persisted state for one Creative Stress Test run (First Boundary — see
 * `docs/PROMPT-CREATIVE-STRESS-TEST.md`-equivalent brief). Mirrors `modules/abtesting/domain/
 * ab-test.ts`'s convention: a plain `Stored*` interface in camelCase, mapped to/from snake_case
 * rows inside the repository.
 *
 * NAMING NOTE: this is deliberately NOT `modules/simulation` (that module is a real, unrelated,
 * load-bearing 6-step campaign-creation dry-run wizard backed by the `simulations` table, whose
 * approval calls `GoLiveService` to create REAL Meta campaigns). "Creative Stress Test" is a
 * buyer-persona / objection-mining / creative-critique feature that shares nothing with it beyond
 * the English word "simulation" — separate module, separate table (`stress_test_runs`), separate
 * routes.
 *
 * `result` jsonb lifecycle (no extra column/migration): `null` (DRAFT/QUEUED) -> `IN_PROGRESS`
 * (RUNNING, per-evaluator step states only) -> `COMPLETED` (full evaluated result + final
 * progress) | `PARTIAL` (FAILED — real outputs that settled before the failure, never a score).
 * Legacy RUNNING/FAILED rows keep `result: null`.
 *
 * STATUS MACHINE (Second Boundary — `063_creative_stress_test_runs_completed_status.sql`):
 * `DRAFT` (persisted, not yet executed) -> `QUEUED` (execute requested) -> `RUNNING` (transient) ->
 * `COMPLETED` (a real evaluator registry ran — see `StressTestEvaluatedResult`) | `FAILED` (every
 * evaluator failed, or a hard error) | `CANCELLED`. `WAITING_FOR_ENGINE` is kept in the type/CHECK
 * constraint ONLY for backward compatibility with any First Boundary row already persisted in that
 * state before the real evaluator registry shipped — no new run ever lands there.
 */
export type StressTestStatus =
  "DRAFT" | "QUEUED" | "RUNNING" | "WAITING_FOR_ENGINE" | "COMPLETED" | "FAILED" | "CANCELLED";

export type StressTestSourceType = "LISTING" | "CAMPAIGN" | "CAMPAIGN_DRAFT" | "CREATIVE_PACKAGE";

export type StressTestMode = "FAST" | "STANDARD" | "DEEP";

/**
 * Objection source selector values (spec section 17-18). Real availability is a STATIC fact of
 * this boundary (no `ObjectionMiningService`, no "Respon Pintar" integration, no `firstMessage`
 * field exist anywhere in this codebase yet — confirmed) — see `objection-sources.ts` for the
 * single source of truth mapping each value to its real/honest-gap status.
 */
export type ObjectionSourceKey =
  | "LISTING_KNOWLEDGE_BASE"
  | "FIRST_MESSAGE_INTELLIGENCE"
  | "RESPON_PINTAR_CONVERSATIONS"
  | "HISTORICAL_OBJECTIONS";

/**
 * Persona preset id (spec section 12) — 5 static, versioned, documented presets. Explicitly
 * labeled as configured presets, NOT claimed as derived from real lead data (that's Second
 * Boundary's `PersonaBuilder`/persona-source-priority system) — see `persona-presets.ts`.
 */
export type PersonaPresetId =
  "PRICE_SENSITIVE" | "SKEPTICAL_BUYER" | "HIGH_INTENT" | "INVESTOR" | "FAMILY_BUYER";

export type StressTestPrimaryGoal = "CPQL" | "HOT_LEAD_RATE" | "CREATIVE_QUALITY" | "MESSAGING_FIT";

/** Legacy First Boundary result marker — see `StressTestStatus`'s own doc for why this is kept. */
export interface StressTestWaitingForEngineResult {
  readonly kind: "WAITING_FOR_ENGINE";
  readonly reason: string;
  readonly objectionSourceAvailability: readonly {
    readonly source: ObjectionSourceKey;
    readonly hasRealData: boolean;
    readonly note: string;
  }[];
}

export type StressTestObjectionSeverity = "HIGH" | "MEDIUM" | "LOW";

/**
 * ONE real, LLM-simulated critique of ONE selected persona reacting to the real creative under
 * test — `LlmService.simulateStressTestPersona`'s validated output, unchanged. `simulated: true` is
 * always present (never `false`) — the honesty marker the frontend renders its
 * "Hasil simulasi AI berdasarkan persona preset — bukan data pembeli nyata" notice from.
 */
export interface StressTestPersonaCritique {
  readonly simulated: true;
  readonly attracts: readonly string[];
  readonly confusions: readonly string[];
  readonly objections: readonly {
    readonly objection: string;
    readonly severity: StressTestObjectionSeverity;
  }[];
  readonly intentDrivers: readonly string[];
  readonly narrativeReaction: string;
}

/**
 * One persona's real evaluation ATTEMPT — `ok: true` with a real `critique`, or `ok: false` with a
 * real, honest `failureReason` (e.g. `PROVIDER_ERROR`/`INVALID_RESPONSE`/`RATE_LIMITED`) when this
 * ONE persona's LLM call failed while others may have succeeded (partial-failure handling).
 */
export interface StressTestPersonaAttempt {
  readonly personaId: PersonaPresetId;
  readonly personaLabel: string;
  readonly ok: boolean;
  readonly critique?: StressTestPersonaCritique;
  readonly failureReason?: string;
}

const COPY_DIMENSION_STATUSES = ["STRONG", "ADEQUATE", "WEAK"] as const;
export type StressTestCopyDimensionStatus = (typeof COPY_DIMENSION_STATUSES)[number];

export interface StressTestCopyDimension {
  readonly status: StressTestCopyDimensionStatus;
  readonly reasoning: string;
}

/** `LlmService.evaluateStressTestCopy`'s real evaluation attempt (or a real, honest failure). */
export interface StressTestCopyEvaluationResult {
  readonly ok: boolean;
  readonly hookClarity?: StressTestCopyDimension;
  readonly offerStrength?: StressTestCopyDimension;
  readonly ctaSpecificity?: StressTestCopyDimension;
  readonly internalConsistency?: StressTestCopyDimension;
  readonly summary?: string;
  readonly failureReason?: string;
}

export type StressTestClaimStatus = "SUPPORTED" | "UNSUPPORTED_CLAIM" | "CONFLICTING_CLAIM";

export interface StressTestClaimFinding {
  readonly claim: string;
  readonly status: StressTestClaimStatus;
  readonly reasoning: string;
  readonly citationDocumentId?: string;
  readonly citationFileName?: string;
}

/**
 * The Fact/Claim Validator's real, honest outcome — `CHECKED` only when
 * `listingKnowledgeService.retrieve` actually returned >=1 real hit AND the LLM call ran (may still
 * be `ok: false` if that call itself failed); `NOT_APPLICABLE` when the run has no real `listingId`
 * or the listing genuinely has no ingested Listing Knowledge documents yet — this is the one
 * evaluator that can honestly say "tidak dapat diverifikasi" instead of silently passing every
 * claim (the brief's own explicit instruction).
 */
export type StressTestFactCheckStatus = "CHECKED" | "NOT_APPLICABLE" | "FAILED";

export interface StressTestFactCheckResult {
  readonly status: StressTestFactCheckStatus;
  readonly note: string;
  readonly findings: readonly StressTestClaimFinding[];
}

export type StressTestScoreBucket =
  "READY_TO_TEST" | "MINOR_REVISION" | "NEEDS_REVISION" | "MAJOR_ISSUES";

export type StressTestDimensionKey = "HOOK" | "OFFER" | "OBJECTION_HANDLING" | "CTA";

/**
 * A dimension score is ONLY ever present when a real evaluator actually produced the signal it is
 * derived from (brief's own explicit constraint) — see `computeStressTestScoring`'s own doc for the
 * exact derivation. Never a placeholder/default score with no real evaluator behind it.
 */
export interface StressTestDimensionScore {
  readonly dimension: StressTestDimensionKey;
  readonly score: number;
}

/**
 * The Second Boundary's real, terminal evaluated result — persisted when `execute()` reaches
 * `COMPLETED`. `overallScore`/`scoreBucket` are `null` only in the (should-be-unreachable, since a
 * `null` overall score with zero dimensions means every evaluator failed, which instead routes the
 * run to `FAILED` — see `CreativeStressTestService.execute`'s own doc) edge case of zero real
 * dimension scores.
 */
export interface StressTestEvaluatedResult {
  readonly kind: "COMPLETED";
  readonly personaCritiques: readonly StressTestPersonaAttempt[];
  readonly copyEvaluation: StressTestCopyEvaluationResult;
  readonly factCheck: StressTestFactCheckResult;
  readonly dimensionScores: readonly StressTestDimensionScore[];
  readonly overallScore: number | null;
  readonly scoreBucket: StressTestScoreBucket | null;
  /** 0-100 — how many of the real evaluators attempted actually succeeded, penalized further when the fact-checker had no real Listing Knowledge to ground against. See `computeStressTestScoring`'s own doc. */
  readonly confidence: number;
  readonly primaryRecommendation: string;
  readonly evaluatorsAttempted: number;
  readonly evaluatorsSucceeded: number;
  /** Honest, human-readable notes on what did NOT run this round (a failed evaluator, or a deferred-scope evaluator this boundary never builds) — never silently hidden. */
  readonly gaps: readonly string[];
  /** Absent on runs created before the Objection Resolution evaluator existed (dashboard: "Belum dinilai"). */
  readonly objectionResolution?: StressTestObjectionResolutionResult;
  /** Final per-evaluator step states. Absent on legacy runs. */
  readonly progress?: StressTestRunProgress;
}

// ---------------------------------------------------------------------------------------------
// Objection Resolution + Goal Impact evaluator
// ---------------------------------------------------------------------------------------------

export type StressTestResolutionStatus =
  | "UNRESOLVED"
  | "PARTIAL"
  | "RESOLVED"
  | "REQUIRES_KNOWLEDGE"
  | "REQUIRES_SALES"
  | "NOT_SOLVABLE_IN_CREATIVE";

/** AI-judged (simulated) impact of an objection on the run's primary goal — never a measured metric. */
export type StressTestGoalImpact = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";

/** Which server-side verification rule changed the LLM's raw assessment — see `objection-resolution.ts`. */
export type StressTestResolutionAdjustment = "EVIDENCE_NOT_FOUND" | "UNGROUNDED_TERM";

export interface StressTestObjectionResolutionItem {
  /** `normalizeObjectionText` of the grouped objection — the dashboard's row join key. */
  readonly key: string;
  readonly objection: string;
  readonly resolutionStatus: StressTestResolutionStatus;
  readonly goalImpact: StressTestGoalImpact;
  readonly shortRecommendation: string;
  /** Verbatim quote from the evaluated creative text (verified server-side), or `null`. */
  readonly evidence: string | null;
  readonly adjustment?: StressTestResolutionAdjustment;
}

/**
 * `ASSESSED` — the LLM call ran and its output was verified (`items` may still skip objections the
 * LLM ignored). `SKIPPED` — never called (no successful persona critique, or no objections).
 * `FAILED` — the call was attempted and failed (`note` carries the reason). `simulated: true` is
 * always present: every status/impact here is an AI assessment, never a fact.
 */
export interface StressTestObjectionResolutionResult {
  readonly status: "ASSESSED" | "SKIPPED" | "FAILED";
  readonly simulated: true;
  readonly note: string;
  readonly items: readonly StressTestObjectionResolutionItem[];
}

// ---------------------------------------------------------------------------------------------
// Per-evaluator progress (persisted inside the existing `result` jsonb — no migration)
// ---------------------------------------------------------------------------------------------

export type StressTestProgressStepKey =
  "PERSONA_SIMULATION" | "COPY_EVALUATION" | "FACT_VALIDATION" | "OBJECTION_RESOLUTION";

export type StressTestProgressState = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";

export interface StressTestProgressStep {
  readonly key: StressTestProgressStepKey;
  readonly state: StressTestProgressState;
  /** PERSONA_SIMULATION only: personas settled so far / personas attempted / personas that failed. */
  readonly done?: number;
  readonly total?: number;
  readonly failed?: number;
}

export interface StressTestRunProgress {
  readonly steps: readonly StressTestProgressStep[];
  readonly updatedAt: string;
}

/** `result` while `status === "RUNNING"` — only real step states, no evaluator output yet. */
export interface StressTestInProgressResult {
  readonly kind: "IN_PROGRESS";
  readonly progress: StressTestRunProgress;
}

/**
 * `result` of a `FAILED` run: whatever REAL evaluator outputs settled before the failure, flagged
 * `partial: true`. Deliberately carries NO `overallScore`/`scoreBucket`/`dimensionScores`/
 * `confidence` — a readiness score from incomplete input would overstate what was evaluated.
 * `hasRealOutput` is `false` when nothing succeeded (the result then only documents which steps
 * failed); the dashboard offers "Lihat Hasil Parsial" only when it is `true`.
 */
export interface StressTestPartialResult {
  readonly kind: "PARTIAL";
  readonly partial: true;
  readonly hasRealOutput: boolean;
  readonly personaCritiques: readonly StressTestPersonaAttempt[];
  readonly copyEvaluation?: StressTestCopyEvaluationResult;
  readonly factCheck?: StressTestFactCheckResult;
  readonly objectionResolution?: StressTestObjectionResolutionResult;
  readonly evaluatorsAttempted: number;
  readonly evaluatorsSucceeded: number;
  readonly gaps: readonly string[];
  readonly progress: StressTestRunProgress;
}

export type StressTestResult =
  | StressTestWaitingForEngineResult
  | StressTestEvaluatedResult
  | StressTestInProgressResult
  | StressTestPartialResult;

export interface StoredStressTestRun {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly sourceType: StressTestSourceType;
  readonly listingId?: string;
  readonly campaignId?: string;
  readonly campaignDraftId?: string;
  readonly creativeIds: readonly string[];
  readonly mode: StressTestMode;
  readonly primaryGoal: StressTestPrimaryGoal;
  readonly personaIds: readonly PersonaPresetId[];
  readonly objectionSources: readonly ObjectionSourceKey[];
  readonly status: StressTestStatus;
  readonly result: StressTestResult | null;
  readonly failedReason?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
}
