import { randomUUID } from "node:crypto";

import type { AssetLibrary } from "@aos/asset-library";
import { PropertyAdAngle } from "@aos/creative-agent";
import type { PropertyCreativeBrief } from "@aos/creative-agent";
import { NotFoundError } from "@aos/errors";
import {
  Branch,
  branchAudienceDefault,
  HOUSING_POLICY_WARNING,
  HOUSING_SPECIAL_AD_CATEGORY,
  propertyBranchAudienceDefault,
} from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, ASSET_LIBRARY } from "../../di-tokens.js";
import { ListingsService } from "../listings/listings.service.js";
import type { TargetingCandidateDto } from "../llm/dto/select-targeting.dto.js";
import { LlmService } from "../llm/llm.service.js";
import { MetaInterestRepository } from "../meta-interests/infrastructure/meta-interest.repository.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import {
  buildKaiPromptDetail as computeKaiPromptDetail,
  buildPropertyKaiPromptDetail as computePropertyKaiPromptDetail,
} from "./domain/kai-prompt-preview.js";
import { computeSimulationScoring } from "./domain/scoring.js";
import type {
  AudienceTargetingPreview,
  JessyPersonaRun,
  JessyStageResult,
  KaiPromptDetail,
  KaiStageResult,
  SelectedAudienceInterest,
  SimulationLogEntry,
  SimulationLogPayload,
  SimulationResult,
  SimulationStep,
  StoredSimulation,
  TamaraStageResult,
} from "./domain/simulation-record.js";
import { selectTargetingCandidates } from "./domain/targeting-candidates.js";
import type { ReviewSimulationBodyDto } from "./dto/review-simulation.dto.js";
import {
  toSimulationHistoryEntryDto,
  toSimulationStatusResponseDto,
  type SimulationHistoryEntryDto,
  type SimulationStatusResponseDto,
} from "./dto/simulation-status.dto.js";
import type { StartSimulationBodyDto } from "./dto/start-simulation.dto.js";
import { callAaosSimulator, AaosSimulatorError } from "./infrastructure/aaos-simulator-client.js";
import { SimulationRepository } from "./infrastructure/simulation.repository.js";

/**
 * Orchestrates the "Simulasi Tamara × Kai × Jessy" dry run (Steps 1-6, AAOS-DASHBOARD-SIMULASI).
 * HARD SCOPE BOUNDARY: this is a preview/scoring tool only. Nothing in this class ever creates a
 * real Meta campaign, activates real WhatsApp auto-reply, or touches real CAPI — `approve`/
 * `reject` record the manager's decision on the row only (Step 6's "Review & Approve").
 *
 * Pipeline sequencing (coordinator note #8): `start()` persists the record and returns a
 * `simulationId` immediately — it does NOT hold the HTTP connection open for the full run (Kie AI
 * video generation alone can take minutes per the original spec). The pipeline itself runs as a
 * detached async task (`void this.runPipeline(...)`); the dashboard polls
 * `GET /api/v1/simulation/:id/status` for progress.
 *
 * Step 3 (Kai) scope note: this pass wires the REAL `LlmService.creativeBrief` call (Tamara →
 * Kai handoff, same as `SimulasiClient.tsx`'s existing "Generate Brief" step) but does NOT invoke
 * `@aos/creative-agent`'s `CreativeOrchestratorService` for real Kie AI video/image generation —
 * nothing in `aaos-api` composes that orchestrator today (verified: no `CreativeOrchestratorService`
 * wiring anywhere in `app.module.ts`/`di-tokens.ts` before this task), and wiring a real, costly,
 * multi-minute external generation call into a brand-new background pipeline without being able to
 * verify it end-to-end in this environment is exactly the risk point 9 of this task's coordinator
 * note calls out. `kai.videoGenerated` is honestly `false` on every run — never a fabricated
 * video/image URL.
 */
@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(ASSET_LIBRARY) private readonly assetLibrary: AssetLibrary | undefined,
    private readonly repository: SimulationRepository,
    private readonly llmService: LlmService,
    private readonly metaInterestRepository: MetaInterestRepository,
    private readonly tenants: TenantRepository,
    private readonly listings: ListingsService,
  ) {}

  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5 — resolves the tenant's real `vertical` via the
   * SAME `TenantRepository`/pattern `SettingsService.getSettings` already uses (coordinator note
   * section 9), NOT a second tenant lookup. NEVER FAILS THE RUN: an unknown tenant id (e.g. a stale
   * header) or a repository error degrades to `"AUTOMOTIVE"` — the real pre-Phase-5 default this
   * simulation module always behaved as — rather than aborting the whole pipeline over a
   * display/branching concern.
   */
  private async resolveVertical(tenantId: string): Promise<"AUTOMOTIVE" | "PROPERTY"> {
    try {
      const tenant = await this.tenants.findByTenantId(tenantId);
      if (tenant === undefined) {
        return "AUTOMOTIVE";
      }
      return tenant.vertical === "PROPERTY" ? "PROPERTY" : "AUTOMOTIVE";
    } catch (caught) {
      this.logger.warn(`SimulationService.resolveVertical(${tenantId}) failed: ${String(caught)}`);
      return "AUTOMOTIVE";
    }
  }

  async start(
    body: StartSimulationBodyDto,
    tenantId: string,
  ): Promise<{ id: string; status: "RUNNING" }> {
    const vertical = await this.resolveVertical(tenantId);
    const created = await this.repository.create({
      id: randomUUID(),
      tenantId,
      objectiveSnapshot: body.objective,
      campaignDataSource: body.campaignDataSource,
      personaIds: body.personaIds,
      branch: body.branch,
    });

    // Detached on purpose (coordinator note #8) — not awaited, errors are caught and persisted
    // inside `runPipeline` itself so an unhandled rejection never crashes the process.
    void this.runPipeline(created.id, body, tenantId, vertical);

    return { id: created.id, status: "RUNNING" };
  }

  private async log(
    id: string,
    step: SimulationStep,
    level: "INFO" | "WARN" | "ERROR",
    message: string,
    payload?: SimulationLogPayload,
  ): Promise<void> {
    const entry: SimulationLogEntry = {
      step,
      level,
      message,
      ...(payload !== undefined ? { payload } : {}),
      createdAt: new Date().toISOString(),
    };
    try {
      await this.repository.appendLog(id, entry);
    } catch (caught) {
      // A log-write failure must never abort the pipeline itself.
      this.logger.warn(`SimulationService.log failed for ${id}: ${String(caught)}`);
    }
  }

  private async runPipeline(
    id: string,
    body: StartSimulationBodyDto,
    tenantId: string,
    vertical: "AUTOMOTIVE" | "PROPERTY",
  ): Promise<void> {
    try {
      await this.log(
        id,
        "SETUP",
        "INFO",
        "Simulasi dimulai dari data yang sudah di-cache/ditarik.",
      );

      // --- Step 2: Tamara (real /api/v1/llm/analyze, in-process — see class doc) ---
      await this.repository.updateStep(id, "TAMARA");
      await this.log(id, "TAMARA", "INFO", "Tamara sedang menganalisa data iklan…");
      const tamaraStart = Date.now();
      const analyzeResult = await this.llmService.analyze({
        campaigns: body.campaigns,
        totals: body.totals,
      });
      const baseTamara: TamaraStageResult = analyzeResult.available
        ? {
            available: true,
            temuan: analyzeResult.temuan,
            rekomendasi: analyzeResult.rekomendasi,
            ringkasan: analyzeResult.ringkasan,
            elapsedMs: Date.now() - tamaraStart,
            coverageScore: 0, // computed below via scoreTamaraCoverage in computeSimulationScoring's inputs
          }
        : {
            available: false,
            reason: analyzeResult.reason,
            elapsedMs: Date.now() - tamaraStart,
            coverageScore: 0,
          };
      await this.log(
        id,
        "TAMARA",
        baseTamara.available ? "INFO" : "WARN",
        baseTamara.available
          ? `Tamara selesai menganalisa dalam ${baseTamara.elapsedMs}ms.`
          : `Tamara tidak tersedia: ${baseTamara.reason ?? "unknown"}.`,
      );

      // --- Step 2b: audience targeting preview (display only — never sent to Meta) ---
      const audienceTargeting = await this.computeAudienceTargeting(id, body, tenantId, vertical);
      const tamara: TamaraStageResult = { ...baseTamara, audienceTargeting };

      // --- Step 3: Kai (real /api/v1/llm/creative-brief; real Kie AI generation NOT invoked) ---
      await this.repository.updateStep(id, "KAI");
      await this.log(id, "KAI", "INFO", "Tamara brief Kai untuk creative refresh…");
      const kaiStart = Date.now();
      const briefResult = await this.llmService.creativeBrief({
        ad: body.kaiAd,
        angle: body.kaiAngle,
        branch: body.kaiBranch,
      });
      const kai: KaiStageResult = briefResult.available
        ? {
            available: true,
            brief: {
              unit: briefResult.unit,
              angle: briefResult.angle,
              branch: briefResult.branch,
              primaryMessage: briefResult.primaryMessage,
              tone: briefResult.tone,
              formats: briefResult.formats,
              avoid: briefResult.avoid,
              urgency: briefResult.urgency,
            },
            elapsedMs: Date.now() - kaiStart,
            videoGenerated: false,
            note: "Brief nyata dari Tamara. Generate video/gambar Kie AI belum dijalankan pada simulasi ini.",
            promptDetail: await this.resolveKaiPromptDetail(
              id,
              briefResult,
              vertical,
              tenantId,
              body,
            ),
          }
        : {
            available: false,
            reason: briefResult.reason,
            elapsedMs: Date.now() - kaiStart,
            videoGenerated: false,
            note: "Brief tidak tersedia — AI unavailable.",
          };
      await this.log(
        id,
        "KAI",
        kai.available ? "INFO" : "WARN",
        kai.available
          ? `Kai menerima brief dalam ${kai.elapsedMs}ms. Video/gambar belum digenerate (belum tersedia pada simulasi ini).`
          : `Kai tidak menerima brief: ${kai.reason ?? "unknown"}.`,
      );

      // --- Step 4+5: Jessy + AI Judge (real cross-app HTTP call to apps/aaos-simulator) ---
      await this.repository.updateStep(id, "JESSY");
      const jessy = await this.runJessyStage(id, body.personaIds);

      // --- Scoring ---
      await this.repository.updateStep(id, "JUDGE");
      const scoring = computeSimulationScoring(tamara, kai, jessy, vertical);
      const result: SimulationResult = {
        tamara: { ...tamara, coverageScore: scoring.tamaraCoverageScore },
        kai,
        jessy,
        scoring,
      };
      await this.log(
        id,
        "JUDGE",
        "INFO",
        `Skor akhir: ${scoring.overallScore} (${scoring.grade}) — verdict ${scoring.verdict}.`,
      );

      await this.repository.updateStep(id, "REVIEW");
      await this.repository.complete(id, result);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      this.logger.error(`SimulationService.runPipeline(${id}) failed: ${message}`);
      await this.log(id, "DONE", "ERROR", `Simulasi gagal: ${message}`);
      await this.repository.fail(id, message);
    }
  }

  /**
   * AAOS-SIMULASI-TARGETING — computes the display-only "Campaign yang Akan Dibuat (Preview)"
   * audience block, as a new step inside the TAMARA stage after the real `LlmService.analyze` call.
   *
   * Two real sources, kept clearly distinguishable in the output:
   *  1. The branch's geo/age default from `@aos/meta-ads-connector`'s `BRANCH_AUDIENCE_DEFAULTS` —
   *     an UNREVIEWED judgment call, carried with its Indonesian caveat (`geoNote`) so the UI can
   *     never present it as confirmed DSS Motor data.
   *  2. Real Meta interests: the stored `meta_interests` catalogue (populated only by real live
   *     Graph API calls via `POST /api/v1/meta-interests/sync`), narrowed to a focused candidate
   *     set, then handed to the real `LlmService.selectTargeting` — whose response is intersected
   *     server-side against the candidate ids before anything reaches this preview.
   *
   * NEVER FAILS THE RUN: an empty catalogue, an unavailable LLM, or even a thrown repository error
   * degrades to a preview with zero interests and an honest `interestsUnavailableReason` — this is
   * a display nicety, not a gate, and a fabricated interest would be far worse than a missing one.
   */
  private async computeAudienceTargeting(
    id: string,
    body: StartSimulationBodyDto,
    tenantId: string,
    vertical: "AUTOMOTIVE" | "PROPERTY",
  ): Promise<AudienceTargetingPreview> {
    const branch = isBranch(body.branch) ? body.branch : body.kaiBranch;
    // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5, Step 2 — PROPERTY tenants read
    // `PROPERTY_BRANCH_AUDIENCE_DEFAULTS` (age 27-55 default, `listings.branch_id`-shaped free-text
    // branches) instead of the automotive `BRANCH_AUDIENCE_DEFAULTS`. `specialAdCategories`/
    // `housingWarning` are the real Meta-mandatory HOUSING category this preview must carry once
    // `vertical === "PROPERTY"` — see `AudienceTargetingPreview`'s class doc for the display-only
    // hard scope boundary.
    const geoDefault =
      vertical === "PROPERTY"
        ? propertyBranchAudienceDefault(branch)
        : branchAudienceDefault(branch);
    const base = {
      branch,
      geo: geoDefault.cities,
      radiusKm: geoDefault.radiusKm,
      ageMin: geoDefault.ageMin,
      ageMax: geoDefault.ageMax,
      geoNote: geoDefault.note,
      specialAdCategories:
        vertical === "PROPERTY" ? ([HOUSING_SPECIAL_AD_CATEGORY] as readonly string[]) : [],
      ...(vertical === "PROPERTY" ? { housingWarning: HOUSING_POLICY_WARNING } : {}),
    };

    try {
      const stored = await this.metaInterestRepository.listByTenant(tenantId);
      const candidates = selectTargetingCandidates(stored, {
        unit: body.kaiAd.name,
        ...(body.kaiAngle !== undefined ? { angle: body.kaiAngle } : {}),
      });

      if (candidates.length === 0) {
        await this.log(
          id,
          "TAMARA",
          "WARN",
          "Belum ada kandidat interest Meta tersimpan — jalankan POST /api/v1/meta-interests/sync dulu. Targeting interest dilewati (bukan hasil palsu).",
          { candidateIds: [], selectedIds: [], rejectedIds: [] },
        );
        return {
          ...base,
          candidateCount: 0,
          interests: [],
          interestsUnavailableReason: "NO_CANDIDATES",
        };
      }

      const candidateDtos: TargetingCandidateDto[] = candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        audienceSizeLower: candidate.audienceSizeLower,
        audienceSizeUpper: candidate.audienceSizeUpper,
        ...(candidate.topic !== undefined ? { topic: candidate.topic } : {}),
      }));

      const selection = await this.llmService.selectTargeting({
        unit: body.kaiAd.name,
        ...(body.kaiAngle !== undefined ? { angle: body.kaiAngle } : {}),
        branch,
        candidates: candidateDtos,
      });

      if (!selection.available) {
        await this.log(
          id,
          "TAMARA",
          "WARN",
          `Tamara tidak bisa memilih interest: ${selection.reason}. Menampilkan geo/usia default saja.`,
          { candidateIds: candidates.map((c) => c.id), selectedIds: [], rejectedIds: [] },
        );
        return {
          ...base,
          candidateCount: candidates.length,
          interests: [],
          interestsUnavailableReason: selection.reason,
        };
      }

      const selectedIds = new Set(selection.interestIds);
      const interests: SelectedAudienceInterest[] = candidates
        .filter((candidate) => selectedIds.has(candidate.id))
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          audienceSizeLower: candidate.audienceSizeLower,
          audienceSizeUpper: candidate.audienceSizeUpper,
          ...(candidate.topic !== undefined ? { topic: candidate.topic } : {}),
        }));

      await this.log(
        id,
        "TAMARA",
        selection.rejectedIds.length > 0 ? "WARN" : "INFO",
        `Tamara memilih ${interests.length} dari ${candidates.length} kandidat interest Meta` +
          (selection.rejectedIds.length > 0
            ? `; ${selection.rejectedIds.length} id karangan ditolak server.`
            : "."),
        {
          candidateIds: candidates.map((candidate) => candidate.id),
          selectedIds: selection.interestIds,
          rejectedIds: selection.rejectedIds,
        },
      );

      return {
        ...base,
        candidateCount: candidates.length,
        interests,
        reasoning: selection.reasoning,
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      this.logger.warn(`SimulationService.computeAudienceTargeting(${id}) failed: ${message}`);
      await this.log(
        id,
        "TAMARA",
        "WARN",
        `Preview targeting gagal dihitung: ${message}. Simulasi tetap dilanjutkan.`,
      );
      return {
        ...base,
        candidateCount: 0,
        interests: [],
        interestsUnavailableReason: "TARGETING_ERROR",
      };
    }
  }

  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — dispatches Step 3's Kai-prompt detail to the
   * automotive or PROPERTY builder depending on the resolved `vertical`, mirroring the same
   * per-vertical dispatch `computeAudienceTargeting`/`computeSimulationScoring` already establish.
   * PROPERTY dispatch needs a real `listings` row (`body.listingId`, Step 1's "Pilih Listing") and
   * angle (`body.kaiPropertyAngle`) — either missing degrades to `undefined` with an honest log line
   * (never a fabricated listing/angle), same "never fails the run" discipline as the automotive path.
   */
  private async resolveKaiPromptDetail(
    id: string,
    briefResult: Extract<
      Awaited<ReturnType<LlmService["creativeBrief"]>>,
      { readonly available: true }
    >,
    vertical: "AUTOMOTIVE" | "PROPERTY",
    tenantId: string,
    body: StartSimulationBodyDto,
  ): Promise<KaiPromptDetail | undefined> {
    if (vertical !== "PROPERTY") {
      return this.buildKaiPromptDetail(id, briefResult);
    }
    if (body.listingId === undefined || body.kaiPropertyAngle === undefined) {
      await this.log(
        id,
        "KAI",
        "WARN",
        "Simulasi PROPERTY tanpa listing/angle terpilih (Step 1) — panel prompt Kai disembunyikan.",
      );
      return undefined;
    }
    return this.buildPropertyKaiPromptDetail(id, tenantId, body.listingId, body.kaiPropertyAngle);
  }

  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — the PROPERTY sibling to `buildKaiPromptDetail`:
   * fetches the real, tenant-scoped `listings` row Step 1's "Pilih Listing" selected (via the same
   * `ListingsService.getById` the Listing Manager itself uses — one lookup path, never a second),
   * builds a real `PropertyCreativeBrief` from it, and hands it to
   * `domain/kai-prompt-preview.ts`'s `buildPropertyKaiPromptDetail`. Real listing photos become
   * `sourcePhotoUrls` — never a fabricated thumbnail.
   *
   * NEVER FAILS THE RUN: an unknown/foreign-tenant `listingId` (`NotFoundError`) or any other thrown
   * error degrades to `undefined` with an honest log line, same discipline as `buildKaiPromptDetail`.
   */
  private async buildPropertyKaiPromptDetail(
    id: string,
    tenantId: string,
    listingId: string,
    angle: PropertyAdAngle,
  ): Promise<KaiPromptDetail | undefined> {
    try {
      const listing = await this.listings.getById(tenantId, listingId);
      const brief: PropertyCreativeBrief = {
        listingId: listing.id,
        listingTitle: listing.title,
        propertyType: listing.propertyType,
        angle,
        ...(listing.branchId !== undefined ? { branch: listing.branchId } : {}),
        ...(listing.waNumber !== undefined ? { waNumber: listing.waNumber } : {}),
        ...(listing.highlights.length > 0 ? { highlights: listing.highlights } : {}),
      };
      const sourcePhotoUrls = listing.photos.map((photo) => photo.url);
      return computePropertyKaiPromptDetail(brief, sourcePhotoUrls);
    } catch (caught) {
      const message =
        caught instanceof NotFoundError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : String(caught);
      this.logger.warn(`SimulationService.buildPropertyKaiPromptDetail(${id}) failed: ${message}`);
      await this.log(id, "KAI", "WARN", `Prompt detail PROPERTY gagal dihitung: ${message}.`);
      return undefined;
    }
  }

  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section C — computes the "Prompt Kai → Kie AI"
   * detail panel's data, once `briefResult.available` is true. Queries real `@aos/asset-library`
   * source photos for `briefResult.unit` (honestly empty when none are filed under that unit — see
   * `buildKaiPromptDetail`'s doc), then hands the real brief fields to
   * `domain/kai-prompt-preview.ts`'s pure, no-external-call builder.
   *
   * AUTOMOTIVE ONLY — see `resolveKaiPromptDetail`'s doc for the PROPERTY sibling.
   *
   * NEVER FAILS THE RUN: any thrown error here is caught and logged; the panel degrades to
   * `undefined` (an honest "not shown") rather than aborting a simulation whose Tamara/Kai brief
   * step already succeeded.
   */
  private async buildKaiPromptDetail(
    id: string,
    briefResult: Extract<
      Awaited<ReturnType<LlmService["creativeBrief"]>>,
      { readonly available: true }
    >,
  ): Promise<KaiPromptDetail | undefined> {
    try {
      const sourcePhotoUrls = await this.findKaiSourcePhotoUrls(briefResult.unit);
      const detail = computeKaiPromptDetail({
        unit: briefResult.unit,
        branch: briefResult.branch,
        angle: briefResult.angle,
        primaryMessage: briefResult.primaryMessage,
        tone: briefResult.tone,
        formats: briefResult.formats,
        avoid: briefResult.avoid,
        urgency: briefResult.urgency,
        sourcePhotoUrls,
      });
      if (detail === undefined) {
        await this.log(
          id,
          "KAI",
          "WARN",
          "Prompt detail tidak bisa dihitung dari brief ini (validasi CreativeBrief gagal) — panel prompt disembunyikan.",
        );
      }
      return detail;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      this.logger.warn(`SimulationService.buildKaiPromptDetail(${id}) failed: ${message}`);
      await this.log(id, "KAI", "WARN", `Prompt detail gagal dihitung: ${message}.`);
      return undefined;
    }
  }

  /**
   * Reads REAL `@aos/asset-library` photos filed under `unit` — the exact same
   * `GetAssetsByUnit` query `CreativePackagesService.findSourcePhotoUrls` runs for the real Kai
   * pipeline. Returns `[]` (a real, meaningful "no photos found") when the library isn't
   * configured, the unit has no scraped/uploaded photos, or the query fails — never a fabricated
   * thumbnail.
   */
  private async findKaiSourcePhotoUrls(unitId: string): Promise<readonly string[]> {
    if (this.assetLibrary === undefined) {
      return [];
    }
    const found = await this.assetLibrary.getAssetsByUnit.execute({ unitId });
    if (!found.ok) {
      return [];
    }
    return found.value.assets.map((asset) => asset.publicUrl.toString());
  }

  private async runJessyStage(
    id: string,
    personaIds: readonly string[],
  ): Promise<JessyStageResult> {
    const jessyStart = Date.now();
    if (this.config.AAOS_SIMULATOR_BASE_URL.length === 0) {
      await this.log(
        id,
        "JESSY",
        "WARN",
        "AAOS_SIMULATOR_BASE_URL belum dikonfigurasi — tahap Jessy/AI Judge dilewati (bukan hasil palsu).",
      );
      return {
        available: false,
        reason: "AAOS_SIMULATOR_BASE_URL is not configured",
        runs: [],
        elapsedMs: Date.now() - jessyStart,
      };
    }

    const runs: JessyPersonaRun[] = [];
    for (const personaId of personaIds) {
      await this.log(
        id,
        "JESSY",
        "INFO",
        `Menjalankan simulasi Jessy untuk persona "${personaId}"…`,
      );
      try {
        const run = await callAaosSimulator(this.config.AAOS_SIMULATOR_BASE_URL, personaId);
        runs.push({
          personaId,
          ok: true,
          finalScore: run.finalScore,
          finalTemperature: run.finalTemperature,
          handoffTriggered: run.handoffTriggered,
          totalTurns: run.totalTurns,
          overallScore: run.overallScore,
          grade: run.grade,
          verdict: run.verdict,
          feedbackItems: run.feedbackItems,
        });
        await this.log(
          id,
          "JESSY",
          "INFO",
          `Persona "${personaId}": skor Judge ${run.overallScore} (${run.grade}).`,
        );
      } catch (caught) {
        const message = caught instanceof AaosSimulatorError ? caught.message : String(caught);
        runs.push({ personaId, ok: false, error: message });
        await this.log(id, "JESSY", "ERROR", `Persona "${personaId}" gagal: ${message}`);
      }
    }

    return { available: true, runs, elapsedMs: Date.now() - jessyStart };
  }

  async getStatus(id: string): Promise<SimulationStatusResponseDto> {
    const simulation = await this.findOrThrow(id);
    const logs = await this.repository.listLogs(id);
    return toSimulationStatusResponseDto(simulation, logs);
  }

  /** Step 6 "Review & Approve" — records the decision only. See this class's hard-scope-boundary doc: no `/api/verdicts`, no Meta/WhatsApp/CAPI call. */
  async approve(id: string, body: ReviewSimulationBodyDto): Promise<SimulationStatusResponseDto> {
    await this.findOrThrow(id);
    await this.repository.recordDecision(
      id,
      "APPROVED",
      body.decidedBy,
      body.notes,
      new Date().toISOString(),
    );
    return this.getStatus(id);
  }

  async reject(id: string, body: ReviewSimulationBodyDto): Promise<SimulationStatusResponseDto> {
    await this.findOrThrow(id);
    await this.repository.recordDecision(
      id,
      "REJECTED",
      body.decidedBy,
      body.notes,
      new Date().toISOString(),
    );
    return this.getStatus(id);
  }

  async history(): Promise<readonly SimulationHistoryEntryDto[]> {
    const simulations = await this.repository.list();
    return simulations.map(toSimulationHistoryEntryDto);
  }

  private async findOrThrow(id: string): Promise<StoredSimulation> {
    const simulation = await this.repository.findById(id);
    if (simulation === undefined) {
      throw new NotFoundError(`No simulation found with id "${id}"`);
    }
    return simulation;
  }
}

/** `StartSimulationBodyDto.branch` is free text (see its schema doc); this narrows it to a real `Branch` member, or `false` so the caller falls back to the validated `kaiBranch`. */
function isBranch(value: string | undefined): value is Branch {
  return value !== undefined && (Object.values(Branch) as string[]).includes(value);
}
