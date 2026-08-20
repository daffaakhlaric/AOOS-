/**
 * Domain shapes for one dry-run simulation record (AAOS-DASHBOARD-SIMULASI). Kept in one file,
 * mirroring `modules/creative-packages`'s precedent of a small, self-contained domain shape for a
 * module with no upstream `@aos/*` package of its own.
 */

/**
 * The 6-step wizard's step names, in order, plus `"GO_LIVE"` (AAOS-GO-LIVE, Phase 4) — the value
 * `GoLiveService` writes to every `simulation_logs.step` it appends, so the dashboard's existing
 * Log Panel step filter can isolate Go Live/rollback activity from the original 6-step run without
 * a second log table. `simulations.current_step` itself is never set to `"GO_LIVE"` — Go Live runs
 * strictly after a simulation's `current_step` has already reached `"DONE"`.
 */
export type SimulationStep =
  "SETUP" | "TAMARA" | "KAI" | "JESSY" | "JUDGE" | "REVIEW" | "DONE" | "GO_LIVE";

/**
 * `"LIVE"`/`"ROLLED_BACK"` (AAOS-GO-LIVE, Phase 4) added on top of the original
 * `"RUNNING" | "DONE" | "ERROR"` set. `"LIVE"` is set only once `GoLiveService.execute` has
 * finished every real step (including the real Meta campaign/adset/ad creation) — never set
 * mid-sequence. `"ROLLED_BACK"` replaces `"LIVE"` once `GoLiveService.rollback` finishes. See
 * `docs/PROMPT-AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY.md` coordinator note section 8's closing
 * paragraph — this was confirmed as real, in-scope schema work for this phase.
 */
export type SimulationStatus = "RUNNING" | "DONE" | "ERROR" | "LIVE" | "ROLLED_BACK";

export type SimulationDecision = "APPROVED" | "REJECTED";

/**
 * One REAL Meta interest Tamara selected for the audience preview (AAOS-SIMULASI-TARGETING).
 * `id`/`name`/`audienceSize*` are Meta's own values, read back out of `meta_interests` (which is
 * only ever populated by real live `GET /search?type=adinterest` calls) — never invented here.
 */
export interface SelectedAudienceInterest {
  readonly id: string;
  readonly name: string;
  readonly audienceSizeLower: number;
  readonly audienceSizeUpper: number;
  readonly topic?: string;
}

/**
 * The display-only "Campaign yang Akan Dibuat (Preview)" audience block
 * (AAOS-SIMULASI-TARGETING). Two very different kinds of value live here, and the distinction is
 * the whole point:
 *
 * - `geo`/`ageMin`/`ageMax`/`geoNote` are an UNREVIEWED INITIAL DEFAULT derived from the branch's
 *   real physical location (`@aos/meta-ads-connector`'s `BRANCH_AUDIENCE_DEFAULTS`). `geoNote`
 *   carries the Indonesian caveat string the UI must render verbatim. These are NOT confirmed DSS
 *   Motor targeting data.
 * - `interests` are REAL Meta interests, with Meta's own ids and audience-size bounds, chosen by a
 *   real `LlmService.selectTargeting` call from a real stored candidate set.
 *
 * HARD SCOPE BOUNDARY: nothing here is ever sent to Meta. It is computed for display in the
 * Simulasi wizard only; `CreateCampaign`/`CreateAdSet` construct no `targeting` field and were not
 * changed by this feature.
 */
export interface AudienceTargetingPreview {
  readonly branch: string;
  readonly geo: readonly string[];
  readonly radiusKm: number;
  readonly ageMin: number;
  readonly ageMax: number;
  /** Verbatim "⚠ Perkiraan awal, perlu direview…" caveat — the UI must show it. */
  readonly geoNote: string;
  /** How many real candidates were queried out of `meta_interests` and shown to Tamara. */
  readonly candidateCount: number;
  readonly interests: readonly SelectedAudienceInterest[];
  /** Tamara's real Indonesian rationale, when the selection succeeded. */
  readonly reasoning?: string;
  /** Why `interests` is empty, when it is (e.g. `NO_CANDIDATES`, or the real LLM unavailable reason). Never a fabricated selection. */
  readonly interestsUnavailableReason?: string;
  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5 — Meta's real `special_ad_categories` value this
   * preview's campaign would be created with. Always `[]` for `AUTOMOTIVE` tenants (no special
   * category applies); `['HOUSING']` for `PROPERTY` tenants, per Meta's mandatory policy for
   * property/housing ads (`packages/meta-ads-connector`'s `HOUSING_SPECIAL_AD_CATEGORY`). Display
   * only, same hard scope boundary as the rest of this preview — never sent to Meta from Simulasi.
   */
  readonly specialAdCategories: readonly string[];
  /**
   * The exact Indonesian warning copy the UI MUST render verbatim whenever `specialAdCategories`
   * includes `'HOUSING'` (`packages/meta-ads-connector`'s `HOUSING_POLICY_WARNING`) — age/gender
   * targeting is disabled by Meta itself once this category is set, so `ageMin`/`ageMax` above are
   * display-only estimates for a PROPERTY simulation, never real `targeting.age_min`/`age_max`.
   */
  readonly housingWarning?: string;
}

/** Step 2 (Tamara) result — the REAL `AnalyzeLlmPayload` shape from `POST /api/v1/llm/analyze`, or `undefined` when Tamara was unavailable (never fabricated). */
export interface TamaraStageResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly temuan?: ReadonlyArray<{
    readonly icon: string;
    readonly judul: string;
    readonly detail: string;
  }>;
  readonly rekomendasi?: ReadonlyArray<{
    readonly aksi: string;
    readonly target: string;
    readonly alasan: string;
    readonly estimasi: string;
  }>;
  readonly ringkasan?: string;
  readonly elapsedMs: number;
  /**
   * `/api/v1/llm/analyze` has no native numeric score (its real response is qualitative — see
   * `llm.service.ts`). This is a deterministic, inspectable PROXY score derived from real response
   * field counts (never a fabricated/hallucinated number) — used only as one input to this
   * simulation's overall gate. See `domain/scoring.ts`'s `scoreTamaraCoverage` for the exact
   * formula.
   */
  readonly coverageScore: number;
  /**
   * AAOS-SIMULASI-TARGETING — the display-only audience preview computed as a new step after the
   * real `LlmService.analyze` call. Optional: absent on every simulation recorded before this
   * feature existed, and absent on a run where the targeting step itself threw (a targeting
   * failure must never fail the whole simulation). See `AudienceTargetingPreview`.
   */
  readonly audienceTargeting?: AudienceTargetingPreview;
}

/** One real Kie AI copy variant, exactly as `@aos/creative-agent`'s `CopyBuilder.buildVariants` produces it — never re-derived or fabricated here. */
export interface KaiPromptCopyVariant {
  readonly id: string;
  readonly variantLabel: string;
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section C — the REAL prompt Kai would send to Kie
 * AI, computed by running the brief through the exact same deterministic, no-external-call pipeline
 * `KaiAgentService.processCreativeBrief` uses (`FormatDecisionService`/`FormatDecider`,
 * `PromptBuildingService`/`AutomotivePromptBuilder`, `CopyBuilder`) — WITHOUT invoking
 * `CreativeOrchestratorService` (no real Kie AI upload/generation call, no credits spent). Every
 * field here is something the real pipeline would actually produce for this exact brief; nothing is
 * a "representative" or hand-written example.
 *
 * `undefined`/empty fields are honest gaps, never filled with a plausible-looking placeholder:
 * `sourcePhotoUrls` is `[]` when `@aos/asset-library` has no photos filed under this brief's `unit`
 * (real for most Simulasi runs — the wizard's ad selection carries no real scraped `unitId`, only a
 * free-text ad name, so a lookup miss is the normal, honest outcome, not a bug).
 */
export interface KaiPromptDetail {
  readonly videoPrompt?: string;
  readonly imagePrompts: readonly string[];
  readonly copyVariants: readonly KaiPromptCopyVariant[];
  /** Why `copyVariants` is empty, when it is (e.g. no `CopyBuilder` exists yet for this vertical) — never silently empty. */
  readonly copyVariantsUnavailableReason?: string;
  readonly sourcePhotoUrls: readonly string[];
  readonly format: string;
  readonly imageModel: string;
  readonly imageAspectRatio: string;
  readonly imageCount: number;
  readonly videoModel?: string;
  readonly videoDurationSeconds?: number;
  readonly videoAspectRatio?: string;
}

/** Step 3 (Kai) result. `videoGenerated`/`imageGenerated` are honestly `false` in this pass — see this module's class docs for why real Kie AI video generation is not invoked here. */
export interface KaiStageResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly brief?: {
    readonly unit: string;
    readonly angle: string;
    readonly branch: string;
    readonly primaryMessage: string;
    readonly tone: string;
    readonly formats: readonly string[];
    readonly avoid: readonly string[];
    readonly urgency: string;
  };
  readonly elapsedMs: number;
  readonly videoGenerated: false;
  readonly note: string;
  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3 — the real prompt detail (see `KaiPromptDetail`),
   * computed only when `brief` is available. `undefined` when the brief itself failed validation
   * (e.g. an invalid angle/branch) or when computing it threw — a prompt-detail failure must never
   * fail the whole simulation, same discipline as `computeAudienceTargeting`.
   */
  readonly promptDetail?: KaiPromptDetail;
}

/** One persona's real Jessy simulation + AI Judge result, proxied from `apps/aaos-simulator`'s `POST /api/simulate`. Fields are the exact subset this module needs for scoring/display — see `infrastructure/aaos-simulator-client.ts` for the full upstream response types. */
export interface JessyPersonaRun {
  readonly personaId: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly finalScore?: number;
  readonly finalTemperature?: string;
  readonly handoffTriggered?: boolean;
  readonly totalTurns?: number;
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  readonly feedbackItems?: ReadonlyArray<{ readonly dimension: string; readonly message: string }>;
}

/** Step 4+5 (Jessy + AI Judge) — one run per selected `PersonaId`. */
export interface JessyStageResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly runs: readonly JessyPersonaRun[];
  readonly elapsedMs: number;
}

export type Grade = "A" | "B" | "C" | "D" | "F";
export type Verdict = "GO" | "CONDITIONAL" | "NO-GO" | "INCOMPLETE";

/** Computed overall gate — see `domain/scoring.ts` for the formula and its judgment-call caveats. */
export interface SimulationScoring {
  readonly tamaraCoverageScore: number;
  readonly kaiScore: number;
  readonly jessyScore: number;
  readonly overallScore: number;
  readonly grade: Grade;
  readonly verdict: Verdict;
  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5 — set only for `PROPERTY` simulations: `false`
   * when the preview's `specialAdCategories` did not include `'HOUSING'` (a real Meta-policy
   * violation this simulation should have caught), in which case `domain/scoring.ts`'s
   * `HOUSING_CATEGORY_PENALTY` (-20) was already subtracted from `overallScore` above. `undefined`
   * for `AUTOMOTIVE` simulations, where this criterion does not apply.
   */
  readonly housingCategoryOk?: boolean;
}

/** The full `simulations.result` JSONB payload once the pipeline finishes (or fails). */
export interface SimulationResult {
  readonly tamara: TamaraStageResult;
  readonly kai: KaiStageResult;
  readonly jessy: JessyStageResult;
  readonly scoring: SimulationScoring;
}

/**
 * Structured data attached to a log line. JSON-shaped by construction — this is persisted straight
 * into `simulation_logs.payload` (JSONB) and returned verbatim to the dashboard's log panel.
 */
export type SimulationLogPayload = Record<string, unknown>;

export interface SimulationLogEntry {
  readonly step: SimulationStep;
  readonly level: "INFO" | "WARN" | "ERROR";
  readonly message: string;
  /**
   * AAOS-SIMULASI-TARGETING: the previously-unused `simulation_logs.payload` JSONB column is now
   * really written — but ONLY by the targeting step, which has genuinely structured output worth
   * inspecting (the real candidate interest ids it queried, the ids Tamara selected, and any ids
   * Tamara invented and the server rejected). Every other log line still writes message-only, so
   * this stays `undefined` for them rather than being padded with an empty object.
   */
  readonly payload?: SimulationLogPayload;
  readonly createdAt: string;
}

/**
 * One entity `GoLiveService.execute` mutated during its Tamara-verdict-execution step (AAOS-GO-LIVE),
 * recorded so `GoLiveService.rollback` can honestly undo it. Only `"ad"` entries are reversible
 * today (via the new `ActivateAd` use case) — a `"campaign"`-targeted FIX verdict has no real
 * inverse (there is no "un-fix an objective" operation), so those are recorded for the audit trail
 * only and are not replayed by rollback. See `docs/PROMPT-AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY.md`
 * coordinator note section 8.
 */
export interface GoLiveRollbackEntry {
  readonly targetType: "ad" | "campaign" | "adset";
  readonly targetId: string;
  readonly action: "PAUSED" | "SCALED" | "FIXED";
  readonly reversible: boolean;
}

/** `simulations.rollback_data` JSONB payload — the newly-created campaign/adset/ad plus every entity `GoLiveService.execute` mutated, per point 4 of the Go Live spec. */
export interface GoLiveRollbackData {
  readonly newCampaignId: string;
  readonly newAdSetId: string;
  readonly newAdId: string;
  readonly mutatedEntities: readonly GoLiveRollbackEntry[];
}

/** One full `simulations` row, domain-shaped (camelCase, dates as ISO strings). */
export interface StoredSimulation {
  readonly id: string;
  readonly tenantId: string;
  readonly objectiveSnapshot: Record<string, unknown>;
  readonly campaignDataSource: "cache" | "fresh";
  readonly personaIds: readonly string[];
  readonly branch?: string;
  readonly status: SimulationStatus;
  readonly currentStep: SimulationStep;
  readonly result?: SimulationResult;
  readonly errorMessage?: string;
  readonly decision?: SimulationDecision;
  readonly decidedBy?: string;
  readonly decisionNotes?: string;
  readonly decidedAt?: string;
  /** AAOS-GO-LIVE: the real Meta campaign id `GoLiveService.execute` created, once `status === 'LIVE'` (or was `'LIVE'` before a rollback). */
  readonly liveCampaignId?: string;
  /** AAOS-GO-LIVE: the real Meta ad id `GoLiveService.execute` created. */
  readonly liveAdId?: string;
  readonly liveAt?: string;
  readonly rolledBackAt?: string;
  readonly rollbackData?: GoLiveRollbackData;
  readonly createdAt: string;
  readonly updatedAt: string;
}
