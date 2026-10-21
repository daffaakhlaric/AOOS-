/**
 * Creative Stress Test (First Boundary) — pure types + mappers, no JSX, matching this app's
 * established convention (`lib/creative-health.ts`/`lib/budget.ts`/`lib/experiments.ts`): an
 * honest-gap idiom, never fabricating content.
 *
 * NAMING NOTE: this is a brand-new feature, deliberately NOT the existing `/api/v1/simulation*`
 * 6-step campaign-creation dry-run wizard (which creates REAL Meta campaigns on approval). It talks
 * to the new `/api/v1/creative-stress-test*` backend only.
 */

export type StressTestSourceType = "LISTING" | "CAMPAIGN" | "CAMPAIGN_DRAFT" | "CREATIVE_PACKAGE";
export type StressTestMode = "FAST" | "STANDARD" | "DEEP";
export type StressTestPrimaryGoal = "CPQL" | "HOT_LEAD_RATE" | "CREATIVE_QUALITY" | "MESSAGING_FIT";
export type StressTestStatus =
  "DRAFT" | "QUEUED" | "RUNNING" | "WAITING_FOR_ENGINE" | "COMPLETED" | "FAILED" | "CANCELLED";

export type PersonaPresetId =
  "PRICE_SENSITIVE" | "SKEPTICAL_BUYER" | "HIGH_INTENT" | "INVESTOR" | "FAMILY_BUYER";

export type ObjectionSourceKey =
  | "LISTING_KNOWLEDGE_BASE"
  | "FIRST_MESSAGE_INTELLIGENCE"
  | "RESPON_PINTAR_CONVERSATIONS"
  | "HISTORICAL_OBJECTIONS";

export interface PersonaPresetDto {
  readonly id: PersonaPresetId;
  readonly label: string;
  readonly description: string;
}

export interface ObjectionSourceDto {
  readonly key: ObjectionSourceKey;
  readonly label: string;
  readonly available: boolean;
  readonly note: string;
}

/** Legacy First Boundary result marker — kept only for any run that predates the real evaluator registry (Second Boundary). No new run ever lands here. */
export interface StressTestWaitingForEngineResultDto {
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
 * test. `simulated: true` is always present — the honesty marker this UI renders its
 * "Hasil simulasi AI berdasarkan persona preset — bukan data pembeli nyata" notice from (same
 * pattern `StressTestBuilder.tsx`'s persona preset cards already use).
 */
export interface StressTestPersonaCritiqueDto {
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

export interface StressTestPersonaAttemptDto {
  readonly personaId: PersonaPresetId;
  readonly personaLabel: string;
  readonly ok: boolean;
  readonly critique?: StressTestPersonaCritiqueDto;
  readonly failureReason?: string;
}

export type StressTestCopyDimensionStatus = "STRONG" | "ADEQUATE" | "WEAK";

export interface StressTestCopyDimensionDto {
  readonly status: StressTestCopyDimensionStatus;
  readonly reasoning: string;
}

export interface StressTestCopyEvaluationResultDto {
  readonly ok: boolean;
  readonly hookClarity?: StressTestCopyDimensionDto;
  readonly offerStrength?: StressTestCopyDimensionDto;
  readonly ctaSpecificity?: StressTestCopyDimensionDto;
  readonly internalConsistency?: StressTestCopyDimensionDto;
  readonly summary?: string;
  readonly failureReason?: string;
}

export type StressTestClaimStatus = "SUPPORTED" | "UNSUPPORTED_CLAIM" | "CONFLICTING_CLAIM";

export interface StressTestClaimFindingDto {
  readonly claim: string;
  readonly status: StressTestClaimStatus;
  readonly reasoning: string;
  readonly citationDocumentId?: string;
  readonly citationFileName?: string;
}

export type StressTestFactCheckStatus = "CHECKED" | "NOT_APPLICABLE" | "FAILED";

export interface StressTestFactCheckResultDto {
  readonly status: StressTestFactCheckStatus;
  readonly note: string;
  readonly findings: readonly StressTestClaimFindingDto[];
}

export type StressTestScoreBucket =
  "READY_TO_TEST" | "MINOR_REVISION" | "NEEDS_REVISION" | "MAJOR_ISSUES";
export type StressTestDimensionKey = "HOOK" | "OFFER" | "OBJECTION_HANDLING" | "CTA";

export interface StressTestDimensionScoreDto {
  readonly dimension: StressTestDimensionKey;
  readonly score: number;
}

/** The Second Boundary's real, terminal evaluated result — present when `run.status === "COMPLETED"`. */
export interface StressTestEvaluatedResultDto {
  readonly kind: "COMPLETED";
  readonly personaCritiques: readonly StressTestPersonaAttemptDto[];
  readonly copyEvaluation: StressTestCopyEvaluationResultDto;
  readonly factCheck: StressTestFactCheckResultDto;
  readonly dimensionScores: readonly StressTestDimensionScoreDto[];
  readonly overallScore: number | null;
  readonly scoreBucket: StressTestScoreBucket | null;
  readonly confidence: number;
  readonly primaryRecommendation: string;
  readonly evaluatorsAttempted: number;
  readonly evaluatorsSucceeded: number;
  readonly gaps: readonly string[];
  /** Absent on runs created before the Objection Resolution evaluator existed -> rows stay "Belum dinilai". */
  readonly objectionResolution?: StressTestObjectionResolutionResultDto;
  /** Final per-evaluator step states. Absent on legacy runs. */
  readonly progress?: StressTestRunProgressDto;
}

/* Objection Resolution + Goal Impact evaluator (AI assessment — never a measured fact). */
export type StressTestResolutionStatus =
  | "UNRESOLVED"
  | "PARTIAL"
  | "RESOLVED"
  | "REQUIRES_KNOWLEDGE"
  | "REQUIRES_SALES"
  | "NOT_SOLVABLE_IN_CREATIVE";
export type StressTestGoalImpact = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";

export interface StressTestObjectionResolutionItemDto {
  /** Backend `normalizeObjectionText` of the grouped objection — same rule as `lib/stress-test-result.ts`. */
  readonly key: string;
  readonly objection: string;
  readonly resolutionStatus: StressTestResolutionStatus;
  readonly goalImpact: StressTestGoalImpact;
  readonly shortRecommendation: string;
  /** Verbatim quote from the evaluated creative text (verified server-side), or null. */
  readonly evidence: string | null;
  readonly adjustment?: "EVIDENCE_NOT_FOUND" | "UNGROUNDED_TERM";
}

export interface StressTestObjectionResolutionResultDto {
  readonly status: "ASSESSED" | "SKIPPED" | "FAILED";
  readonly simulated: true;
  readonly note: string;
  readonly items: readonly StressTestObjectionResolutionItemDto[];
}

/* Per-evaluator progress (persisted by the backend while `execute()` runs). */
export type StressTestProgressStepKey =
  "PERSONA_SIMULATION" | "COPY_EVALUATION" | "FACT_VALIDATION" | "OBJECTION_RESOLUTION";
export type StressTestProgressState = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";

export interface StressTestProgressStepDto {
  readonly key: StressTestProgressStepKey;
  readonly state: StressTestProgressState;
  readonly done?: number;
  readonly total?: number;
  readonly failed?: number;
}

export interface StressTestRunProgressDto {
  readonly steps: readonly StressTestProgressStepDto[];
  readonly updatedAt: string;
}

/** `result` while RUNNING — real step states only. */
export interface StressTestInProgressResultDto {
  readonly kind: "IN_PROGRESS";
  readonly progress: StressTestRunProgressDto;
}

/** `result` of a FAILED run — real outputs that settled before the failure; never a score/bucket/confidence. */
export interface StressTestPartialResultDto {
  readonly kind: "PARTIAL";
  readonly partial: true;
  readonly hasRealOutput: boolean;
  readonly personaCritiques: readonly StressTestPersonaAttemptDto[];
  readonly copyEvaluation?: StressTestCopyEvaluationResultDto;
  readonly factCheck?: StressTestFactCheckResultDto;
  readonly objectionResolution?: StressTestObjectionResolutionResultDto;
  readonly evaluatorsAttempted: number;
  readonly evaluatorsSucceeded: number;
  readonly gaps: readonly string[];
  readonly progress: StressTestRunProgressDto;
}

export type StressTestResultDto =
  | StressTestWaitingForEngineResultDto
  | StressTestEvaluatedResultDto
  | StressTestInProgressResultDto
  | StressTestPartialResultDto;

export interface StressTestRunDto {
  readonly id: string;
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
  readonly result: StressTestResultDto | null;
  readonly failedReason?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
}

export const MODE_LABELS: Record<StressTestMode, string> = {
  FAST: "Fast",
  STANDARD: "Standard",
  DEEP: "Deep",
};

export const MODE_DESCRIPTIONS: Record<StressTestMode, string> = {
  FAST: "Ringkasan cepat — cakupan persona/objection lebih sempit.",
  STANDARD: "Cakupan seimbang — cocok untuk sebagian besar creative.",
  DEEP: "Cakupan paling lengkap — waktu proses lebih lama.",
};

export const PRIMARY_GOAL_LABELS: Record<StressTestPrimaryGoal, string> = {
  CPQL: "CPQL (Cost per Qualified Lead)",
  HOT_LEAD_RATE: "Hot Lead Rate",
  CREATIVE_QUALITY: "Kualitas Creative",
  MESSAGING_FIT: "Kesesuaian Messaging",
};

export const STATUS_LABELS: Record<StressTestStatus, string> = {
  DRAFT: "Draft",
  QUEUED: "Antrian",
  RUNNING: "Berjalan",
  WAITING_FOR_ENGINE: "Menunggu Engine Evaluasi",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
};

export const SCORE_BUCKET_LABELS: Record<StressTestScoreBucket, string> = {
  READY_TO_TEST: "Siap Diuji",
  MINOR_REVISION: "Revisi Minor",
  NEEDS_REVISION: "Perlu Revisi",
  MAJOR_ISSUES: "Masalah Besar",
};

export const DIMENSION_LABELS: Record<StressTestDimensionKey, string> = {
  HOOK: "Hook",
  OFFER: "Offer",
  OBJECTION_HANDLING: "Objection Handling",
  CTA: "CTA",
};

export const OBJECTION_SEVERITY_LABELS: Record<StressTestObjectionSeverity, string> = {
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
};

export const CLAIM_STATUS_LABELS: Record<StressTestClaimStatus, string> = {
  SUPPORTED: "Didukung",
  UNSUPPORTED_CLAIM: "Tidak Didukung",
  CONFLICTING_CLAIM: "Bertentangan",
};

export const COPY_DIMENSION_STATUS_LABELS: Record<StressTestCopyDimensionStatus, string> = {
  STRONG: "Kuat",
  ADEQUATE: "Cukup",
  WEAK: "Lemah",
};

/**
 * The right-rail "Simulation Preview" categories — Second Boundary: these evaluators now genuinely
 * run (`LlmService.simulateStressTestPersona`/`evaluateStressTestCopy`/`validateStressTestClaims`).
 * "Consensus Score lintas evaluator" is deliberately NOT listed — a separate Consensus Engine is
 * still out of scope this boundary (see `CreativeStressTestService`'s own doc); the real aggregation
 * this boundary ships is `computeStressTestScoring`'s dimension-score average, not a multi-evaluator
 * consensus vote.
 */
export const PLANNED_EVALUATION_CATEGORIES: readonly string[] = [
  "Buyer Persona Simulation (AI, per preset yang dipilih — dibatasi jumlah sesuai mode)",
  "Copy Evaluator (Hook, Offer, CTA, konsistensi)",
  "Fact / Claim Check terhadap Listing Knowledge Base (jika tersedia)",
  "Objection Resolution & Dampak ke Tujuan (estimasi AI, setelah simulasi persona)",
];

export function findPersonaPreset(
  presets: readonly PersonaPresetDto[],
  id: PersonaPresetId,
): PersonaPresetDto | undefined {
  return presets.find((preset) => preset.id === id);
}

export function isTerminal(status: StressTestStatus): boolean {
  return (
    status === "WAITING_FOR_ENGINE" ||
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  );
}

const SEVERITY_RANK: Record<StressTestObjectionSeverity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Max length the aaos-api `POST /api/v1/creative-packages/property` (and its Next.js proxy routes) accept for `primaryMessage`/`message` — see `PropertyCreatePackageBodySchema`/the brief route's own `body.message.length > 2000` check. */
const KAI_BRIEF_MAX_LENGTH = 2000;

/**
 * "Kirim ke Kai" (Send to Kai) revision handoff — deterministic string assembly from an already-real,
 * already-evaluated Creative Stress Test result. NEVER a second LLM call, NEVER invented text: every
 * line below traces to one real field on `result` (a real dimension score, a real simulated
 * objection with its real persona label, a real fact-check finding, or the real
 * `primaryRecommendation`). The caller loads the return value into an editable textarea — the user
 * reviews/edits it before it is ever sent, same convention as `CampaignTabs.tsx`'s existing
 * "Send creative brief to Kai" drawer.
 *
 * Organized as real "Pertahankan / Ubah / Hindari" (Preserve / Change / Avoid) sections when the
 * real result data supports that split; a section is omitted entirely when no real field maps into
 * it (never a placeholder/empty bullet).
 */
export function composeKaiBrief(result: StressTestEvaluatedResultDto): string {
  const preserveLines: string[] = [];
  if (result.copyEvaluation.ok) {
    const strongDims: readonly {
      readonly label: string;
      readonly dim: StressTestCopyEvaluationResultDto["hookClarity"];
    }[] = [
      { label: "Hook", dim: result.copyEvaluation.hookClarity },
      { label: "Offer", dim: result.copyEvaluation.offerStrength },
      { label: "CTA", dim: result.copyEvaluation.ctaSpecificity },
      { label: "Konsistensi internal", dim: result.copyEvaluation.internalConsistency },
    ];
    for (const { label, dim } of strongDims) {
      if (dim !== undefined && dim.status === "STRONG") {
        preserveLines.push(`${label} sudah kuat — ${dim.reasoning}`);
      }
    }
  }
  const attracts = Array.from(
    new Set(
      result.personaCritiques.flatMap((p) =>
        p.ok && p.critique !== undefined ? p.critique.attracts : [],
      ),
    ),
  );
  for (const attract of attracts.slice(0, 3)) {
    preserveLines.push(`Elemen yang menarik pada simulasi persona: ${attract}`);
  }

  const changeLines: string[] = [];
  const lowestDimension = [...result.dimensionScores].sort((a, b) => a.score - b.score)[0];
  if (lowestDimension !== undefined) {
    if (lowestDimension.dimension === "OBJECTION_HANDLING") {
      changeLines.push(
        `Dimensi ${DIMENSION_LABELS[lowestDimension.dimension]} adalah skor terendah pada hasil evaluasi (${lowestDimension.score}/100).`,
      );
    } else if (result.copyEvaluation.ok) {
      const detailByDimension: Partial<
        Record<StressTestDimensionKey, StressTestCopyEvaluationResultDto["hookClarity"]>
      > = {
        HOOK: result.copyEvaluation.hookClarity,
        OFFER: result.copyEvaluation.offerStrength,
        CTA: result.copyEvaluation.ctaSpecificity,
      };
      const detail = detailByDimension[lowestDimension.dimension];
      if (detail !== undefined) {
        changeLines.push(
          `${DIMENSION_LABELS[lowestDimension.dimension]} (skor ${lowestDimension.score}/100) — ${detail.reasoning}`,
        );
      }
    }
  }
  const rankedObjections = result.personaCritiques
    .filter((p) => p.ok && p.critique !== undefined)
    .flatMap((p) =>
      (p.critique?.objections ?? []).map((o) => ({
        objection: o.objection,
        severity: o.severity,
        personaLabel: p.personaLabel,
      })),
    )
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const topObjection = rankedObjections[0];
  if (topObjection !== undefined) {
    changeLines.push(
      `Objection severity ${OBJECTION_SEVERITY_LABELS[topObjection.severity]} dari simulasi persona ${topObjection.personaLabel}: "${topObjection.objection}".`,
    );
  }

  const avoidLines: string[] = [];
  if (result.factCheck.status === "CHECKED") {
    const conflicting = result.factCheck.findings.find((f) => f.status === "CONFLICTING_CLAIM");
    const unsupported = result.factCheck.findings.find((f) => f.status === "UNSUPPORTED_CLAIM");
    const flagged = conflicting ?? unsupported;
    if (flagged !== undefined) {
      avoidLines.push(
        `Klaim "${flagged.claim}" — ${CLAIM_STATUS_LABELS[flagged.status]}: ${flagged.reasoning}`,
      );
    }
  }

  const sections: readonly { readonly heading: string; readonly lines: readonly string[] }[] = [
    { heading: "Pertahankan", lines: preserveLines },
    { heading: "Ubah", lines: changeLines },
    { heading: "Hindari", lines: avoidLines },
  ].filter((s) => s.lines.length > 0);

  const recommendationLine = `Rekomendasi utama dari Creative Stress Test: ${result.primaryRecommendation}`;
  const body = sections
    .map((s) => `${s.heading}:\n${s.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");
  const full = body.length > 0 ? `${recommendationLine}\n\n${body}` : recommendationLine;
  return full.length > KAI_BRIEF_MAX_LENGTH ? full.slice(0, KAI_BRIEF_MAX_LENGTH) : full;
}
