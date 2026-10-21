import { randomUUID } from "node:crypto";

import { NotFoundError } from "@aos/errors";
import { Injectable, Logger, Optional } from "@nestjs/common";

import { CreativePackageRepository } from "../creative-packages/infrastructure/creative-package.repository.js";
import type { KnowledgeHit } from "../listing-knowledge/knowledge.types.js";
import { ListingKnowledgeService } from "../listing-knowledge/listing-knowledge.service.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
import { ListingsService } from "../listings/listings.service.js";
import type {
  StressTestCreativeUnderTest,
  StressTestObjectionResolutionRequestDto,
} from "../llm/dto/stress-test-evaluators.dto.js";
import { LlmService } from "../llm/llm.service.js";

import { MODE_PERSONA_CAP } from "./domain/mode-caps.js";
import { groupSimulatedObjections } from "./domain/objection-grouping.js";
import { objectionPromptId, verifyObjectionAssessments } from "./domain/objection-resolution.js";
import { objectionSourceAvailability } from "./domain/objection-sources.js";
import { findPersonaPreset } from "./domain/persona-presets.js";
import { StressTestProgressTracker } from "./domain/stress-test-progress.js";
import type {
  StoredStressTestRun,
  StressTestCopyEvaluationResult,
  StressTestEvaluatedResult,
  StressTestFactCheckResult,
  StressTestObjectionResolutionResult,
  StressTestPartialResult,
  StressTestPersonaAttempt,
  StressTestRunProgress,
} from "./domain/stress-test-run.js";
import { computeStressTestScoring } from "./domain/stress-test-scoring.js";
import type { CreateStressTestRunBodyDto } from "./dto/create-stress-test-run.dto.js";
import { StressTestRunRepository } from "./infrastructure/stress-test-run.repository.js";

type ListingFacts = StressTestObjectionResolutionRequestDto["listingFacts"];
type KnowledgeExcerpt = StressTestObjectionResolutionRequestDto["knowledgeExcerpts"][number];

/** Real Listing Knowledge retrieval outcome, shared by the Fact Validator and the Objection Resolution evaluator. */
type KnowledgeRetrieval =
  | { readonly kind: "HITS"; readonly hits: readonly KnowledgeHit[] }
  | { readonly kind: "NONE"; readonly note: string };

/** Evaluator outputs collected as they settle — what `markFailed` persists as a partial result. */
interface CollectedOutputs {
  personaAttempts?: readonly StressTestPersonaAttempt[];
  copyEvaluation?: StressTestCopyEvaluationResult;
  factCheck?: StressTestFactCheckResult;
  objectionResolution?: StressTestObjectionResolutionResult;
}

const RESOLUTION_ASSESSED_NOTE =
  "Penilaian AI (simulasi) — status resolusi dan dampak ke tujuan adalah estimasi AI, bukan data pembeli nyata.";

/**
 * Backs `/api/v1/creative-stress-test/*` (Creative Stress Test). Structural template:
 * `modules/abtesting/abtesting.service.ts`.
 *
 * `execute()` runs a real, bounded evaluator registry — buyer persona simulation
 * (`LlmService.simulateStressTestPersona`), copy evaluation (`LlmService.evaluateStressTestCopy`),
 * fact/claim validation (`LlmService.validateStressTestClaims`, grounded in real
 * `listing-knowledge` retrieval), and — once persona critiques have settled — Objection Resolution +
 * Goal Impact (`LlmService.evaluateStressTestObjectionResolution`, verified server-side by
 * `verifyObjectionAssessments`) — and aggregates their real outputs via `computeStressTestScoring`.
 * Synchronous HTTP flow (no queue/worker infra exists in this app); every LLM call is bounded:
 * `MODE_PERSONA_CAP` persona calls + 1 copy + at most 1 fact-check + at most 1 objection
 * resolution, so a DEEP run makes at most 5 + 1 + 1 + 1 = 8 real OpenAI calls.
 *
 * PROGRESS: while it runs, per-evaluator step states are persisted (one write per state change)
 * inside the existing `result` jsonb as `{ kind: "IN_PROGRESS", progress }` — see
 * `StressTestProgressTracker`. So a client polling `GET /:id` sees real step progress while the
 * `POST /:id/execute` request is still in flight.
 *
 * STILL OUT OF SCOPE: Creative Strategy Evaluator, Campaign Strategy Evaluator, a separate Consensus
 * Engine, real persona derivation from leads, real First-Message/Respon-Pintar-sourced objections,
 * calibration/live-validation tracking.
 */
@Injectable()
export class CreativeStressTestService {
  private readonly logger = new Logger(CreativeStressTestService.name);

  constructor(
    private readonly repository: StressTestRunRepository,
    private readonly llm: LlmService,
    private readonly creativePackages: CreativePackageRepository,
    private readonly listings: ListingsService,
    private readonly listingKnowledge: ListingKnowledgeService,
    // `@Optional()` — same reasoning as `AbTestingService`'s own `now` param doc: a bare
    // `Function`-typed constructor param with only a default value still gets a real DI resolution
    // attempt from Nest without this, crashing bootstrap.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  async createRun(
    body: CreateStressTestRunBodyDto,
    tenantId: string,
  ): Promise<StoredStressTestRun> {
    const run = await this.repository.create({
      id: randomUUID(),
      tenantId,
      name: body.name,
      sourceType: body.sourceType,
      ...(body.listingId !== undefined ? { listingId: body.listingId } : {}),
      ...(body.campaignId !== undefined ? { campaignId: body.campaignId } : {}),
      ...(body.campaignDraftId !== undefined ? { campaignDraftId: body.campaignDraftId } : {}),
      creativeIds: body.creativeIds,
      mode: body.mode,
      primaryGoal: body.primaryGoal,
      personaIds: body.personaIds,
      objectionSources: body.objectionSources,
    });
    return run;
  }

  async getRun(id: string, tenantId: string): Promise<StoredStressTestRun> {
    return this.findOrThrow(id, tenantId);
  }

  async listRuns(tenantId: string): Promise<readonly StoredStressTestRun[]> {
    return this.repository.listByTenant(tenantId);
  }

  /**
   * `POST /api/v1/creative-stress-test/:id/execute` — real evaluator registry run.
   * `DRAFT -> QUEUED -> RUNNING -> COMPLETED | FAILED` (all real, persisted status writes).
   *
   * PARTIAL FAILURE: if some evaluators succeed and some fail, the run still reaches `COMPLETED`
   * with whichever real results succeeded, a real reduced `confidence`, and an honest `gaps` list.
   * A failed Objection Resolution call is exactly such a gap — the run still completes.
   *
   * FULL FAILURE: if neither the persona simulation nor the copy evaluator produced a dimension
   * score, or an unexpected error is thrown mid-run, the run lands on `FAILED` with a real
   * `failedReason`, and whatever real evaluator outputs HAD settled are persisted as a
   * `StressTestPartialResult` (`partial: true`, no score/bucket/confidence).
   */
  async execute(id: string, tenantId: string): Promise<StoredStressTestRun> {
    const existing = await this.findOrThrow(id, tenantId);
    if (existing.status !== "DRAFT") {
      return existing;
    }
    await this.repository.markStatus(id, "QUEUED");

    const cappedPersonaIds = existing.personaIds.slice(0, MODE_PERSONA_CAP[existing.mode]);
    const tracker = new StressTestProgressTracker(
      cappedPersonaIds.length,
      (progress) => this.repository.updateProgress(id, progress),
      this.now,
      (error) =>
        this.logger.warn(
          `Creative Stress Test run ${id}: progress write failed — ${error instanceof Error ? error.message : String(error)}`,
        ),
    );
    await this.repository.markRunning(id, tracker.snapshot());

    const collected: CollectedOutputs = {};
    try {
      const { creative, listingIdForFactCheck, listing } = await this.resolveCreativeUnderTest(
        existing,
        tenantId,
      );
      const listingFacts = await this.loadListingFacts(tenantId, listingIdForFactCheck, listing);
      const knowledgePromise = this.retrieveKnowledge(tenantId, creative, listingIdForFactCheck);

      const personaThenResolution = (async (): Promise<void> => {
        const personaAttempts = await this.runPersonaSimulations(
          tenantId,
          cappedPersonaIds,
          existing.primaryGoal,
          creative,
          (ok) => tracker.personaSettled(ok),
        );
        collected.personaAttempts = personaAttempts;
        const knowledge = await knowledgePromise;
        collected.objectionResolution = await this.runObjectionResolution(
          tenantId,
          existing.primaryGoal,
          creative,
          listingFacts,
          knowledge,
          personaAttempts,
          tracker,
        );
      })();
      const copy = this.runCopyEvaluation(tenantId, existing.primaryGoal, creative).then((r) => {
        collected.copyEvaluation = r;
        tracker.set("COPY_EVALUATION", r.ok ? "DONE" : "FAILED");
      });
      const fact = knowledgePromise
        .then((knowledge) => this.runFactValidation(tenantId, creative, knowledge))
        .then((r) => {
          collected.factCheck = r;
          tracker.set(
            "FACT_VALIDATION",
            r.status === "CHECKED" ? "DONE" : r.status === "FAILED" ? "FAILED" : "SKIPPED",
          );
        });

      // allSettled (not all): every branch finishes first so `collected` is as complete as it can be
      // before a thrown error routes the run to FAILED with a partial result.
      const settled = await Promise.allSettled([personaThenResolution, copy, fact]);
      const rejected = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
      if (rejected !== undefined) {
        throw rejected.reason;
      }
      await tracker.flush();

      const personaAttempts = collected.personaAttempts ?? [];
      const copyEvaluation = collected.copyEvaluation ?? {
        ok: false,
        failureReason: "Tidak selesai.",
      };
      const factCheck = collected.factCheck ?? {
        status: "FAILED",
        note: "Tidak selesai.",
        findings: [],
      };
      const scoring = computeStressTestScoring(
        personaAttempts,
        copyEvaluation,
        factCheck,
        collected.objectionResolution,
      );
      const completedAtIso = this.now().toISOString();

      if (scoring.dimensionScores.length === 0) {
        const failedReason =
          "Semua evaluator gagal dijalankan (buyer persona simulation dan copy evaluator sama-sama gagal) — tidak ada skor nyata yang bisa dihasilkan untuk run ini.";
        await this.repository.markFailed(
          id,
          failedReason,
          completedAtIso,
          buildPartialResult(collected, tracker.snapshot(), scoring.gaps),
        );
        this.logger.warn(`Creative Stress Test run ${id} FAILED — every evaluator failed.`);
        return this.findOrThrow(id, tenantId);
      }

      const result: StressTestEvaluatedResult = {
        kind: "COMPLETED",
        personaCritiques: personaAttempts,
        copyEvaluation,
        factCheck,
        dimensionScores: scoring.dimensionScores,
        overallScore: scoring.overallScore,
        scoreBucket: scoring.scoreBucket,
        confidence: scoring.confidence,
        primaryRecommendation: scoring.primaryRecommendation,
        evaluatorsAttempted: scoring.evaluatorsAttempted,
        evaluatorsSucceeded: scoring.evaluatorsSucceeded,
        gaps: scoring.gaps,
        ...(collected.objectionResolution !== undefined
          ? { objectionResolution: collected.objectionResolution }
          : {}),
        progress: tracker.snapshot(),
      };
      await this.repository.markCompleted(id, result, completedAtIso);
      this.logger.log(
        `Creative Stress Test run ${id} COMPLETED — overall score ${String(scoring.overallScore)}, confidence ${String(scoring.confidence)}.`,
      );
      this.logger.debug(
        `Objection source availability for run ${id}: ${JSON.stringify(objectionSourceAvailability(existing.objectionSources))}`,
      );
      return this.findOrThrow(id, tenantId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Creative Stress Test run ${id} FAILED with an unexpected error: ${message}`,
      );
      await tracker.flush();
      const failedReason = `Run gagal karena error internal: ${message}`;
      try {
        await this.repository.markFailed(
          id,
          failedReason,
          this.now().toISOString(),
          buildPartialResult(collected, tracker.finalSnapshot(), [failedReason]),
        );
      } catch {
        throw error;
      }
      return this.findOrThrow(id, tenantId);
    }
  }

  async cancel(id: string, tenantId: string): Promise<StoredStressTestRun> {
    await this.findOrThrow(id, tenantId);
    await this.repository.markStatus(id, "CANCELLED");
    return this.findOrThrow(id, tenantId);
  }

  private async findOrThrow(id: string, tenantId: string): Promise<StoredStressTestRun> {
    const run = await this.repository.findById(tenantId, id);
    if (run === undefined) {
      throw new NotFoundError(`Creative Stress Test run ${id} not found`);
    }
    return run;
  }

  /**
   * Resolves the run's `creativeIds`/`listingId` back to REAL creative content — never invents ad
   * copy that was never written.
   *
   * - `sourceType === "CAMPAIGN" | "CREATIVE_PACKAGE"`: `creativeIds` are real
   *   `StoredCreativePackage` ids — the FIRST one that actually resolves (tenant-scoped) supplies
   *   its real `copyVariants[0]`/`angle`/`decidedFormat`, `isProxyFromListing: false`. Its own real
   *   `listingId` (PROPERTY packages carry one) is reused for the Fact Validator when the run
   *   itself has no `listingId`.
   * - `sourceType === "LISTING"`: the real listing's own `title`/`description`/`price` stand in as
   *   a copy proxy, `isProxyFromListing: true`. The loaded listing is returned (`listing`) so its
   *   structured facts are reused without a second fetch; `null` = the fetch was attempted and failed.
   * - `sourceType === "CAMPAIGN_DRAFT"`, or nothing resolves: an honest, all-`undefined` creative —
   *   every downstream evaluator's own `hasRealCreativeText` gate short-circuits without an LLM call.
   */
  private async resolveCreativeUnderTest(
    run: StoredStressTestRun,
    tenantId: string,
  ): Promise<{
    readonly creative: StressTestCreativeUnderTest;
    readonly listingIdForFactCheck?: string;
    readonly listing?: ListingResponseDto | null;
  }> {
    if (run.sourceType === "CAMPAIGN" || run.sourceType === "CREATIVE_PACKAGE") {
      for (const creativeId of run.creativeIds) {
        const pkg = await this.creativePackages
          .findById(tenantId, creativeId)
          .catch(() => undefined);
        if (pkg === undefined) {
          continue;
        }
        const variant = pkg.copyVariants[0];
        return {
          creative: {
            primaryText: variant?.primaryText,
            headline: variant?.headline,
            description: variant?.description,
            angle: pkg.angle,
            format: pkg.decidedFormat ?? pkg.requestedFormat,
            isProxyFromListing: false,
          },
          listingIdForFactCheck: run.listingId ?? pkg.listingId,
        };
      }
      return { creative: { isProxyFromListing: false }, listingIdForFactCheck: run.listingId };
    }

    if (run.sourceType === "LISTING" && run.listingId !== undefined) {
      try {
        const listing = await this.listings.getById(tenantId, run.listingId);
        return {
          creative: {
            headline: listing.title,
            description: listing.description,
            primaryText: `Harga: Rp ${listing.price.toLocaleString("id-ID")}`,
            format: "LISTING_PHOTOS",
            isProxyFromListing: true,
          },
          listingIdForFactCheck: run.listingId,
          listing,
        };
      } catch {
        return {
          creative: { isProxyFromListing: true },
          listingIdForFactCheck: run.listingId,
          listing: null,
        };
      }
    }

    return { creative: { isProxyFromListing: false }, listingIdForFactCheck: run.listingId };
  }

  /** Real structured listing facts (only fields that have a value) — `{}` when there is no listing or it fails to load. */
  private async loadListingFacts(
    tenantId: string,
    listingId: string | undefined,
    alreadyLoaded: ListingResponseDto | null | undefined,
  ): Promise<ListingFacts> {
    if (alreadyLoaded !== undefined) {
      return alreadyLoaded === null ? {} : listingFactsOf(alreadyLoaded);
    }
    if (listingId === undefined) {
      return {};
    }
    try {
      return listingFactsOf(await this.listings.getById(tenantId, listingId));
    } catch {
      return {};
    }
  }

  /** Real LLM call per capped persona — one independent attempt each, partial-failure-safe. */
  private async runPersonaSimulations(
    tenantId: string,
    personaIds: StoredStressTestRun["personaIds"],
    primaryGoal: string,
    creative: StressTestCreativeUnderTest,
    onSettled: (ok: boolean) => void,
  ): Promise<readonly StressTestPersonaAttempt[]> {
    return Promise.all(
      personaIds.map(async (personaId): Promise<StressTestPersonaAttempt> => {
        const attempt = await this.simulateOnePersona(tenantId, personaId, primaryGoal, creative);
        onSettled(attempt.ok);
        return attempt;
      }),
    );
  }

  private async simulateOnePersona(
    tenantId: string,
    personaId: StoredStressTestRun["personaIds"][number],
    primaryGoal: string,
    creative: StressTestCreativeUnderTest,
  ): Promise<StressTestPersonaAttempt> {
    const preset = findPersonaPreset(personaId);
    if (preset === undefined) {
      return {
        personaId,
        personaLabel: personaId,
        ok: false,
        failureReason: "Persona preset tidak dikenal.",
      };
    }
    const response = await this.llm.simulateStressTestPersona(tenantId, {
      personaId,
      personaLabel: preset.label,
      personaDescription: preset.description,
      primaryGoal,
      creative,
    });
    if (!response.available) {
      return {
        personaId,
        personaLabel: preset.label,
        ok: false,
        failureReason: `${response.reason}: ${response.message}`,
      };
    }
    return {
      personaId,
      personaLabel: preset.label,
      ok: true,
      critique: {
        simulated: true,
        attracts: response.attracts,
        confusions: response.confusions,
        objections: response.objections,
        intentDrivers: response.intentDrivers,
        narrativeReaction: response.narrativeReaction,
      },
    };
  }

  /** Exactly ONE real LLM call — objective copy-quality evaluation, independent of persona. */
  private async runCopyEvaluation(
    tenantId: string,
    primaryGoal: string,
    creative: StressTestCreativeUnderTest,
  ): Promise<StressTestCopyEvaluationResult> {
    const response = await this.llm.evaluateStressTestCopy(tenantId, { primaryGoal, creative });
    if (!response.available) {
      return { ok: false, failureReason: `${response.reason}: ${response.message}` };
    }
    return {
      ok: true,
      hookClarity: response.hookClarity,
      offerStrength: response.offerStrength,
      ctaSpecificity: response.ctaSpecificity,
      internalConsistency: response.internalConsistency,
      summary: response.summary,
    };
  }

  /** Real Listing Knowledge retrieval (no LLM call). Never throws — a failure is an honest `NONE`. */
  private async retrieveKnowledge(
    tenantId: string,
    creative: StressTestCreativeUnderTest,
    listingId: string | undefined,
  ): Promise<KnowledgeRetrieval> {
    if (listingId === undefined) {
      return {
        kind: "NONE",
        note: "Tidak dapat diverifikasi — belum ada Listing Knowledge untuk listing ini (run tidak memiliki listing terkait).",
      };
    }

    const query = creativeTextOf(creative).replace(/\n/g, " ").slice(0, 1000);
    if (query.trim().length === 0) {
      return {
        kind: "NONE",
        note: "Tidak dapat diverifikasi — belum ada Listing Knowledge untuk listing ini (tidak ada teks creative untuk dicari).",
      };
    }

    try {
      const retrieved = await this.listingKnowledge.retrieve(tenantId, listingId, query, 6);
      if (retrieved.hits.length === 0) {
        return {
          kind: "NONE",
          note: "Tidak dapat diverifikasi — belum ada Listing Knowledge untuk listing ini.",
        };
      }
      return { kind: "HITS", hits: retrieved.hits };
    } catch (error) {
      this.logger.warn(
        `Fact Validator retrieval failed for listing ${listingId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        kind: "NONE",
        note: "Tidak dapat diverifikasi — belum ada Listing Knowledge untuk listing ini (retrieval gagal).",
      };
    }
  }

  /**
   * At most ONE real LLM call, and only when real Listing Knowledge exists to ground against — the
   * honest "tidak dapat diverifikasi" path never calls OpenAI at all.
   */
  private async runFactValidation(
    tenantId: string,
    creative: StressTestCreativeUnderTest,
    knowledge: KnowledgeRetrieval,
  ): Promise<StressTestFactCheckResult> {
    if (knowledge.kind === "NONE") {
      return { status: "NOT_APPLICABLE", note: knowledge.note, findings: [] };
    }
    const response = await this.llm.validateStressTestClaims(tenantId, {
      creative,
      knowledgeExcerpts: toExcerpts(knowledge.hits),
    });
    if (!response.available) {
      return {
        status: "FAILED",
        note: `${response.reason}: ${response.message}`,
        findings: [],
      };
    }
    return {
      status: "CHECKED",
      note: "Diperiksa terhadap Listing Knowledge nyata.",
      findings: response.findings,
    };
  }

  /**
   * At most ONE real LLM call, only after persona critiques settled and only when they produced ≥1
   * real objection. The raw LLM output is verified by `verifyObjectionAssessments` (evidence must
   * literally exist in the creative text, no ungrounded offers, "Butuh data:" for missing facts)
   * before it is returned.
   */
  private async runObjectionResolution(
    tenantId: string,
    primaryGoal: string,
    creative: StressTestCreativeUnderTest,
    listingFacts: ListingFacts,
    knowledge: KnowledgeRetrieval,
    personaAttempts: readonly StressTestPersonaAttempt[],
    tracker: StressTestProgressTracker,
  ): Promise<StressTestObjectionResolutionResult> {
    if (!personaAttempts.some((p) => p.ok)) {
      tracker.set("OBJECTION_RESOLUTION", "SKIPPED");
      return {
        status: "SKIPPED",
        simulated: true,
        note: "Tidak dijalankan — tidak ada simulasi persona yang berhasil.",
        items: [],
      };
    }
    const objections = groupSimulatedObjections(personaAttempts);
    if (objections.length === 0) {
      tracker.set("OBJECTION_RESOLUTION", "SKIPPED");
      return {
        status: "SKIPPED",
        simulated: true,
        note: "Tidak dijalankan — simulasi persona tidak memunculkan keberatan.",
        items: [],
      };
    }

    tracker.set("OBJECTION_RESOLUTION", "RUNNING");
    const knowledgeExcerpts = knowledge.kind === "HITS" ? toExcerpts(knowledge.hits) : [];
    const response = await this.llm.evaluateStressTestObjectionResolution(tenantId, {
      primaryGoal,
      creative,
      listingFacts,
      knowledgeExcerpts,
      objections: objections.map((o, i) => ({
        id: objectionPromptId(i),
        objection: o.objection,
        severity: o.severity,
        personaLabels: [...o.personaLabels],
      })),
    });
    if (!response.available) {
      tracker.set("OBJECTION_RESOLUTION", "FAILED");
      return {
        status: "FAILED",
        simulated: true,
        note: `${response.reason}: ${response.message}`,
        items: [],
      };
    }

    const creativeText = creativeTextOf(creative);
    const groundingText = [
      creativeText,
      ...Object.values(listingFacts).map((v) => (Array.isArray(v) ? v.join(" ") : String(v))),
      ...knowledgeExcerpts.map((e) => e.excerpt),
    ].join("\n");
    const items = verifyObjectionAssessments({
      objections,
      assessments: response.assessments,
      creativeText,
      groundingText,
    });
    tracker.set("OBJECTION_RESOLUTION", "DONE");
    return { status: "ASSESSED", simulated: true, note: RESOLUTION_ASSESSED_NOTE, items };
  }
}

/** The exact creative text every evaluator saw — also the haystack for the evidence substring check. */
function creativeTextOf(creative: StressTestCreativeUnderTest): string {
  return [creative.headline, creative.primaryText, creative.description]
    .filter((s): s is string => s !== undefined && s.trim().length > 0)
    .join("\n");
}

function toExcerpts(hits: readonly KnowledgeHit[]): KnowledgeExcerpt[] {
  return hits.map((hit) => ({
    documentId: hit.document_id,
    fileName: hit.file_name,
    excerpt: hit.text_content.slice(0, 500),
  }));
}

/** Only real, non-empty listing fields — never a default/placeholder value. */
function listingFactsOf(listing: ListingResponseDto): ListingFacts {
  const facts: Record<string, string | number | string[]> = {};
  const put = (key: string, value: string | number | undefined): void => {
    if (value === undefined) return;
    if (typeof value === "string" && value.trim().length === 0) return;
    if (typeof value === "number" && (!Number.isFinite(value) || value <= 0)) return;
    facts[key] = value;
  };
  put("title", listing.title);
  put("propertyType", listing.propertyType === "UNSPECIFIED" ? undefined : listing.propertyType);
  put("price", listing.price);
  put("landArea", listing.landArea);
  put("buildArea", listing.buildArea);
  put("bedrooms", listing.bedrooms);
  put("bathrooms", listing.bathrooms);
  put("garage", listing.garage);
  put("floors", listing.floors);
  put("certificate", listing.certificate);
  put("condition", listing.condition);
  put("electricity", listing.electricity);
  put("facing", listing.facing);
  put("address", listing.address);
  put("kecamatan", listing.kecamatan);
  put("city", listing.city);
  put("province", listing.province);
  if (listing.highlights.length > 0) {
    facts.highlights = [...listing.highlights];
  }
  return facts;
}

/**
 * The `FAILED` run's partial result — real outputs only; attempted/succeeded use the same
 * accounting as `computeStressTestScoring` (personas + copy + objection resolution when called).
 */
function buildPartialResult(
  collected: CollectedOutputs,
  progress: StressTestRunProgress,
  gaps: readonly string[],
): StressTestPartialResult {
  const personaCritiques = collected.personaAttempts ?? [];
  const resolution = collected.objectionResolution;
  const resolutionCalled = resolution !== undefined && resolution.status !== "SKIPPED";
  const evaluatorsAttempted =
    personaCritiques.length +
    (collected.copyEvaluation !== undefined ? 1 : 0) +
    (resolutionCalled ? 1 : 0);
  const evaluatorsSucceeded =
    personaCritiques.filter((p) => p.ok).length +
    (collected.copyEvaluation?.ok === true ? 1 : 0) +
    (resolution?.status === "ASSESSED" ? 1 : 0);
  const hasRealOutput = evaluatorsSucceeded > 0 || collected.factCheck?.status === "CHECKED";
  return {
    kind: "PARTIAL",
    partial: true,
    hasRealOutput,
    personaCritiques,
    ...(collected.copyEvaluation !== undefined ? { copyEvaluation: collected.copyEvaluation } : {}),
    ...(collected.factCheck !== undefined ? { factCheck: collected.factCheck } : {}),
    ...(resolution !== undefined ? { objectionResolution: resolution } : {}),
    evaluatorsAttempted,
    evaluatorsSucceeded,
    gaps,
    progress,
  };
}
