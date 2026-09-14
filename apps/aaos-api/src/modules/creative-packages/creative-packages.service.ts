import { randomUUID } from "node:crypto";

import type { AssetLibrary } from "@aos/asset-library";
import type { BranchManager } from "@aos/branch-manager";
import { BranchId } from "@aos/branch-manager";
import {
  ConfidenceScore,
  CreativeFormat,
  PropertyCopyBuilder,
  PropertyFormatDecider,
  PropertyPromptBuilder,
  scorePropertyAdAngleStrength,
} from "@aos/creative-agent";
import type {
  CopyVariant,
  ImageSpec,
  KaiAgentRuntime,
  OrchestrateGenerationOutput,
  PropertyCopyVariant,
  PropertyCreativeBrief,
  VideoSpec,
} from "@aos/creative-agent";
import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { CreativeBrief, CreativeBriefId } from "@aos/meta-ads-agent";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  ASSET_LIBRARY,
  BRANCH_MANAGER,
  KAI_AGENT_RUNTIME,
} from "../../di-tokens.js";
import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { AiJudgeService } from "../ai-judge/ai-judge.service.js";
import { AuditLogService } from "../audit-log/audit-log.service.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
import { ListingsService } from "../listings/listings.service.js";
import { LlmService } from "../llm/llm.service.js";
import { ModeGuardService, type TenantMode } from "../mode-guard/mode-guard.service.js";

import { buildCreativeBrief } from "./domain/creative-brief.factory.js";
import type { CreativeLogJson } from "./domain/creative-log.js";
import type {
  CreativeGenerationOutcome,
  CreativePackageFormat,
  StoredCopyVariant,
  StoredCreativePackage,
} from "./domain/creative-package.js";
import { runQaChecks } from "./domain/creative-qa.js";
import type {
  CreatePackageBodyDto,
  GetLogsQueryDto,
  GetPackagesQueryDto,
} from "./dto/create-package.dto.js";
import type { PropertyCreatePackageBodyDto } from "./dto/create-property-package.dto.js";
import {
  toCreativeLogResponseDto,
  toCreativePackageResponseDto,
  type CreativeLogResponseDto,
  type CreativePackageDetailResponseDto,
  type CreativePackageResponseDto,
} from "./dto/creative-package-response.dto.js";
import type { ApprovePackageBodyDto, RejectPackageBodyDto } from "./dto/review-package.dto.js";
import { CreativeLogRepository } from "./infrastructure/creative-log.repository.js";
import { CreativePackageRepository } from "./infrastructure/creative-package.repository.js";

const MS_PER_HOUR = 3_600_000;

/**
 * Kie AI's real, confirmed-live reference-image limit for both image-to-video and image-to-image
 * generation — the SAME figure `@aos/creative-agent`'s `KaiAgentService.ts` pins as
 * `MAX_SOURCE_PHOTOS` (that file's own comment: "REAL BUG FIX: Kie AI's real reference-image limit
 * is 2 (confirmed live, 2026-08-18)") and `CreativeOrchestratorService.tryUploadSourcePhotos`'s own
 * docstring documents ("Kie AI's real, confirmed-live limit is 2 reference images"). Duplicated
 * here rather than exported from `@aos/creative-agent` — same "small deterministic constant stays
 * local to each real caller" discipline `PropertyCopyBuilder.buildWithinLimit`'s own docstring
 * documents for this codebase.
 */
const MAX_SOURCE_PHOTOS = 2;

/**
 * AAOS LOOP UPGRADE, Sprint 8b (Prompt 19 Step 4e) — the spec's own literal cap: "retry generate max
 * 2x". 1 initial attempt + 2 retries = 3 total real Kie AI generation attempts before a real,
 * honest `FAILED` state. Used only by `triggerAutoLoopGeneration`'s QA/retry loop — the pre-existing
 * manual `generate()`/`generateProperty()` paths are unchanged (no QA, no retry, exactly as before
 * this dispatch).
 */
const MAX_GENERATION_ATTEMPTS = 3;

const propertyFormatDecider = new PropertyFormatDecider();
const propertyPromptBuilder = new PropertyPromptBuilder();
const propertyCopyBuilder = new PropertyCopyBuilder();

/**
 * Backs `/api/v1/creative-packages/*` (AAOS-CREATIVE-REVIEW).
 *
 * THIS IS THE FIRST PLACE IN `apps/aaos-api` THAT DRIVES THE REAL KAI/KIE AI PIPELINE.
 * `KAI_AGENT_RUNTIME` is a real `KaiAgentFactory.create(...)` bundle composed in `app.module.ts`
 * from real `@aos/asset-library` (`GetAssetsByUnit`/`SaveAiCreative`) and real
 * `@aos/creative-connector` use cases (`UploadSourceImage`/`GenerateLongVideo`/`GenerateImageSet`/
 * `DownloadMedia`, i.e. real Kie AI HTTP calls that cost real credits). Nothing here stubs, fakes,
 * or short-circuits it.
 *
 * HARD SCOPE BOUNDARY (decided by the user): there is NO automatic trigger anywhere in this class.
 * `create()` persists a `DRAFT` and calls nothing. Generation happens only from an explicit
 * `POST .../:id/generate` (or `create({ generate: true })`, which is the same explicit human
 * click). There is no cron, no scheduler, no "full auto mode", and no code path by which a brief
 * reaches Kie AI without a human having approved that specific brief first.
 *
 * Job lifecycle mirrors `ScraperService`'s verified pattern: `generate()` flips the row to
 * `GENERATING` and returns IMMEDIATELY — a Veo 3 video takes minutes, far longer than any sane
 * HTTP timeout — while the pipeline itself runs as a detached async task whose every error path is
 * caught and persisted. The dashboard's "Sedang Diproses" tab polls the same persisted state, so a
 * restart or a second replica reports the truth rather than losing the job.
 *
 * Every `creative_logs` row written here corresponds to something that ACTUALLY happened. There is
 * no synthetic narration: `BRIEF_SENT` is written when the real brief is handed to
 * `ProcessCreativeBrief`, `GENERATE` after the real source-photo query resolves (carrying the real
 * count found), `COMPLETE` from the real returned `CreativePackage`, `ERROR` from a real thrown or
 * returned error, `APPROVED`/`REJECTED` from a real human decision.
 */
@Injectable()
export class CreativePackagesService {
  private readonly logger = new Logger(CreativePackagesService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(KAI_AGENT_RUNTIME) private readonly kai: KaiAgentRuntime | undefined,
    @Inject(ASSET_LIBRARY) private readonly assetLibrary: AssetLibrary | undefined,
    /**
     * The SAME real, globally-provided `BranchManager` bundle (`app.module.ts`'s
     * `BranchManagerFactory.create(...)`, registered `global: true`) `BranchesModule` already
     * injects — reused here (Kai manual-shoot escalation, below) purely for its
     * `getAvailableSales` use case, never a second `@aos/branch-manager` composition. Because the
     * root module is registered `global: true`, this resolves with no explicit module import and
     * no circular-import risk (verified directly — `BranchesModule`'s own doc comment confirms the
     * same global-token precedent).
     */
    @Inject(BRANCH_MANAGER) private readonly branchManager: BranchManager,
    private readonly repository: CreativePackageRepository,
    private readonly logRepository: CreativeLogRepository,
    /**
     * K1/K2 — the SAME real, tenant-scoped `ListingsService.getById` the Listing Manager and
     * `SimulationService`'s PROPERTY Kai-prompt preview already use for a `listings` lookup, not a
     * second query path.
     */
    private readonly listings: ListingsService,
    /**
     * Kai manual-shoot escalation (below) — real `ModeGuardService`/`ActivityLogger`, the SAME
     * small standalone modules `CampaignsModule` already imports for the same "stamp the tenant's
     * real mode, write one real `agent_activities` row" purpose. Kai's own generation pipeline is
     * NOT DEV/LIVE-gated (this class's own doc: "there is no code path by which a brief reaches Kie
     * AI without a human having approved that specific brief first" — no simulate variant exists),
     * so `modeGuard` is used here only to honestly STAMP the row's `mode` field, never to gate or
     * simulate the escalation write itself.
     */
    private readonly modeGuard: ModeGuardService,
    private readonly activityLogger: ActivityLogger,
    /**
     * AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) — real per-run judging infrastructure, injected the
     * SAME way `activityLogger` above already is (a small, standalone `AgentRunsModule`). Records
     * one real `agent_runs` row per real generation completion — see `recordAgentRun` below, the
     * ONE real helper both `runGeneration` (AUTOMOTIVE) and `runGenerationProperty` (PROPERTY)
     * reuse for both their success paths AND `recordFailure`'s shared failure path.
     */
    private readonly agentRunsService: AgentRunsService,
    /**
     * AAOS-AI-JUDGE-SELF-IMPROVING (Phase J2) — real, LLM-scored judgment of the `agent_runs` row
     * `recordAgentRun` below writes, best-effort (see `AiJudgeService.judgeRun`'s own doc).
     * Injected the same way `agentRunsService` above already is.
     */
    private readonly aiJudgeService: AiJudgeService,
    /**
     * AAOS LOOP UPGRADE, Sprint 8b (Prompt 19 Step 4) — real `audit_log` writer for the
     * `CREATIVE_GENERATED` action_type `045_audit_log.sql` reserved for this real generation-
     * completion writer. Injected the same way `activityLogger` above already is (a small,
     * standalone `AuditLogModule` this module now imports) — used only by
     * `triggerAutoLoopGeneration`'s QA/retry pipeline (`runGenerationPropertyWithQaRetry`), never by
     * the pre-existing manual `generate()`/`generateProperty()` paths.
     */
    private readonly auditLog: AuditLogService,
    /**
     * AAOS-SAMANTHA-LLM-AD-COPY — real, shared `LlmService.generateAdCopyVariants` (the SAME
     * OpenAI-backed service `MetaAdsService`/`SimulationService`/etc. already inject, never a
     * bespoke composition) used by `generateProperty` below to replace the deterministic
     * `PropertyCopyBuilder` templates with genuinely LLM-generated, varied copy — with an honest,
     * mandatory fallback to those same deterministic templates on any LLM/schema failure (see
     * `buildPropertyCopyVariants`'s own doc).
     */
    private readonly llmService: LlmService,
  ) {}

  private get tenantId(): string {
    return this.config.AAOS_TENANT_ID;
  }

  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — the real, tenant-scoped lookup `CampaignsService.
   * createPropertyCampaign` uses to fetch the matched `creative_packages` row (its real
   * Kai/Kie-AI-generated media + `copyVariants`) when publishing a real multi-ad campaign, rather
   * than reaching into `CreativePackageRepository` directly (which `CreativePackagesModule` does
   * not export — same "reuse the real service, never a second read path" discipline this module's
   * own class doc already establishes for `AbTestingModule`). Real `NotFoundError` for a
   * missing/foreign-tenant id, same as `findOrThrowScoped`.
   */
  async getForCampaignPublish(tenantId: string, id: string): Promise<StoredCreativePackage> {
    return this.findOrThrowScoped(tenantId, id);
  }

  async list(query: GetPackagesQueryDto): Promise<readonly CreativePackageResponseDto[]> {
    const packages = await this.repository.list(this.tenantId, {
      ...(query.status !== undefined ? { status: query.status } : {}),
      limit: query.limit,
    });
    return packages.map(toCreativePackageResponseDto);
  }

  /** `GET /api/v1/creative-packages/:id` — the single-item lookup the dashboard previously faked by re-fetching the whole list and `.find()`-ing client-side. */
  async byId(id: string): Promise<CreativePackageDetailResponseDto> {
    const pkg = await this.findOrThrow(id);
    const logs = await this.logRepository.list({
      tenantId: this.tenantId,
      packageId: id,
      limit: 200,
    });
    return {
      package: toCreativePackageResponseDto(pkg),
      logs: logs.map(toCreativeLogResponseDto),
    };
  }

  async logs(query: GetLogsQueryDto): Promise<readonly CreativeLogResponseDto[]> {
    const since =
      query.sinceHours === undefined
        ? undefined
        : new Date(Date.now() - query.sinceHours * MS_PER_HOUR).toISOString();
    const entries = await this.logRepository.list({
      tenantId: this.tenantId,
      ...(query.packageId !== undefined ? { packageId: query.packageId } : {}),
      ...(query.eventType !== undefined ? { eventType: query.eventType } : {}),
      ...(since !== undefined ? { since } : {}),
      limit: query.limit,
    });
    return entries.map(toCreativeLogResponseDto);
  }

  /**
   * Persists a brief as a `DRAFT`. When `generate` is true — and ONLY then — the real pipeline is
   * kicked off immediately afterwards, exactly as if the manager had pressed "Kirim ke Kai" on the
   * saved draft.
   */
  async create(body: CreatePackageBodyDto): Promise<CreativePackageResponseDto> {
    const created = await this.repository.create({
      id: randomUUID(),
      tenantId: this.tenantId,
      // A real `CreativeBriefId` (UUID) minted here, then validated again by
      // `CreativeBrief.create` when the brief is actually built at generate time.
      briefId: CreativeBriefId.generate().toString(),
      ...(body.adId !== undefined ? { adId: body.adId } : {}),
      ...(body.stableId !== undefined ? { stableId: body.stableId } : {}),
      vertical: "AUTOMOTIVE",
      branch: body.branch,
      unit: body.unit,
      ...(body.unitModel !== undefined ? { unitModel: body.unitModel } : {}),
      title: body.title ?? `${body.unitModel ?? body.unit} ${body.branch} · ${body.angle}`,
      angle: body.angle,
      targetPersona: body.targetPersona,
      reason: body.reason ?? defaultReason(body.origin),
      requestedFormat: body.format,
      primaryMessage: body.primaryMessage,
      urgency: body.urgency,
      origin: body.origin,
    });

    if (!body.generate) {
      return toCreativePackageResponseDto(created);
    }
    return this.generate(created.id);
  }

  /**
   * Starts a REAL generation run for an existing package. Returns as soon as the row is `GENERATING`
   * — the Kie AI calls run detached (see this class's doc).
   */
  async generate(id: string): Promise<CreativePackageResponseDto> {
    const pkg = await this.findOrThrow(id);
    if (pkg.status === "GENERATING") {
      throw new ValidationError(`Creative package "${id}" is already generating`);
    }
    if (pkg.vertical !== "AUTOMOTIVE" || pkg.unit === undefined) {
      // A PROPERTY package (K1/K2) has its own `generateProperty()` — this AUTOMOTIVE-only method
      // reads `pkg.unit`/`pkg.branch` unconditionally below, so a non-AUTOMOTIVE row is rejected
      // loudly here rather than reaching `findSourcePhotoUrls(undefined)`.
      throw new ValidationError(
        `Creative package "${id}" is vertical="${pkg.vertical}"; use POST /api/v1/creative-packages/property/:id/generate instead`,
      );
    }
    const kai = this.requireKai();

    // Real query, run BEFORE flipping the row so the persisted `source_photo_urls` reflect what
    // actually exists. This is the same `GetAssetsByUnit` query `KaiAgentService` itself runs; it
    // is read here purely to record honestly how many real scraped photos Kai had to work with.
    const sourcePhotoUrls = await this.findSourcePhotoUrls(pkg.unit);
    await this.repository.markGenerating(id, sourcePhotoUrls);

    const briefResult = buildCreativeBrief({ pkg, createdAt: new Date() });
    if (!briefResult.ok) {
      await this.repository.fail(id, briefResult.error.message);
      await this.appendLog({
        packageId: id,
        fromAgent: "SYSTEM",
        eventType: "ERROR",
        message: `Brief tidak valid: ${briefResult.error.message}`,
        error: briefResult.error.message,
      });
      throw briefResult.error;
    }
    const brief = briefResult.value;

    await this.appendLog({
      packageId: id,
      fromAgent: pkg.origin === "SAMANTHA" ? "SAMANTHA" : "MANAGER",
      toAgent: "KAI",
      eventType: "BRIEF_SENT",
      message: `Brief ${pkg.angle} untuk ${pkg.unitModel ?? pkg.unit} (${pkg.branch}) dikirim ke Kai.`,
      brief: briefToJson(pkg),
      ...(pkg.adId !== undefined ? { adId: pkg.adId } : {}),
      ...(pkg.stableId !== undefined ? { stableId: pkg.stableId } : {}),
    });
    await this.appendLog({
      packageId: id,
      fromAgent: "KAI",
      toAgent: "KIE_AI",
      eventType: "GENERATE",
      message:
        sourcePhotoUrls.length > 0
          ? `Kai mulai generate (${sourcePhotoUrls.length} foto unit tersedia sebagai referensi).`
          : "Kai mulai generate — tidak ada foto unit di asset library, Kai generate tanpa foto referensi.",
      metadata: {
        requestedFormat: pkg.requestedFormat,
        sourcePhotosFound: sourcePhotoUrls.length,
        sourcePhotoUrls: [...sourcePhotoUrls],
      },
    });

    // The response is read BEFORE the pipeline is spawned so it always describes the state this
    // call actually produced ("accepted, now GENERATING"), rather than racing the detached run and
    // sometimes reporting a terminal status the caller never asked about.
    const accepted = await this.findOrThrow(id);

    // Detached on purpose — not awaited. Every error path inside `runGeneration` is caught and
    // persisted, so an unhandled rejection can never crash the process.
    void this.runGeneration(id, brief, sourcePhotoUrls, Date.now(), kai);

    return toCreativePackageResponseDto(accepted);
  }

  /**
   * K1 — `POST /api/v1/creative-packages/property`. Persists a `DRAFT` from a real, tenant-scoped
   * `listings` row, mirroring `create()`'s "DRAFT unless generate:true" discipline exactly. Throws
   * the real `NotFoundError` `ListingsService.getById` throws for a missing/foreign-tenant
   * `listingId` — same tenant-isolation guarantee the rest of `modules/listings` already
   * establishes (Property Tenant Isolation Phase 1/2).
   */
  async createProperty(
    tenantId: string,
    body: PropertyCreatePackageBodyDto,
  ): Promise<CreativePackageResponseDto> {
    const listing = await this.listings.getById(tenantId, body.listingId);
    const created = await this.repository.create({
      id: randomUUID(),
      tenantId,
      briefId: CreativeBriefId.generate().toString(),
      vertical: "PROPERTY",
      listingId: listing.id,
      ...(listing.branchId !== undefined ? { branch: listing.branchId } : {}),
      title: body.title ?? `${listing.title} · ${body.angle}`,
      angle: body.angle,
      reason: body.reason ?? defaultReason(body.origin),
      requestedFormat: body.format,
      primaryMessage: body.primaryMessage ?? listing.title,
      urgency: body.urgency,
      origin: body.origin,
      aiRecommended: body.aiRecommended,
    });

    if (!body.generate) {
      return toCreativePackageResponseDto(created);
    }
    return this.generateProperty(tenantId, created.id);
  }

  /**
   * K2 — `POST /api/v1/creative-packages/property/:id/generate`. The PROPERTY sibling to
   * `generate()`: real, tenant-scoped `ListingsService.getById` lookup, `sourcePhotoUrls` resolved
   * DIRECTLY from `listing.photos` (Finding 7 — no `@aos/asset-library`/`unitId` detour: that
   * table has no `listing_id` concept at all), capped at Kie AI's real 2-image limit
   * (`MAX_SOURCE_PHOTOS` above). A listing with zero photos degrades to a REAL text-only brief
   * (`sourcePhotoAvailable = false`) — never a fabricated placeholder image URL.
   *
   * Threads into the SAME real `CreativeOrchestratorService` instance the AUTOMOTIVE path uses
   * (`kai.orchestratorService` — additive on `KaiAgentRuntime`, see that interface's docstring):
   * `KaiAgentService.processCreativeBrief` (what `generate()` calls) is hard-typed to the
   * AUTOMOTIVE `CreativeBrief` and does its own unit-keyed photo lookup internally, so it cannot be
   * driven by an already-resolved PROPERTY `sourcePhotoUrls` list.
   */
  async generateProperty(
    tenantId: string,
    id: string,
    options?: {
      readonly qaAndRetry?: boolean;
      /**
       * Bulk-publish widening (user-requested: "Publish otomatis creative dalam jumlah besar
       * (8-25) langsung ke Meta"). Threaded to `buildPropertyCopyVariants` ->
       * `LlmService.generateAdCopyVariants`'s `targetCount`. Omitted (the pre-existing default)
       * keeps every existing caller's exact prior behavior — exactly 3 variants.
       */
      readonly requestedVariantCount?: number;
    },
  ): Promise<CreativePackageResponseDto> {
    const pkg = await this.findOrThrowScoped(tenantId, id);
    if (pkg.status === "GENERATING") {
      throw new ValidationError(`Creative package "${id}" is already generating`);
    }
    if (pkg.vertical !== "PROPERTY" || pkg.listingId === undefined) {
      throw new ValidationError(
        `Creative package "${id}" is vertical="${pkg.vertical}"; use POST /api/v1/creative-packages/:id/generate instead`,
      );
    }
    const kai = this.requireKai();
    const listing = await this.listings.getById(tenantId, pkg.listingId);

    const sourcePhotoUrls = listing.photos.map((photo) => photo.url).slice(0, MAX_SOURCE_PHOTOS);
    await this.repository.markGenerating(id, sourcePhotoUrls);

    // Kai Creative Engine Sprint 3 — real, honest angle-strength reasoning for THIS package's
    // already-decided angle (`pkg.angle`), when `scorePropertyAdAngleStrength` (Sprint 1) actually
    // backs it with a real signal from this listing's own data. `undefined` (never fabricated) when
    // the angle came from an LLM brief/manual pick the scorer has no honest signal for — see
    // `PropertyPromptBuilder.hasAngleReasoning`'s own doc for how the prompt treats this.
    const angleReasoning = scorePropertyAdAngleStrength({
      propertyType: listing.propertyType,
      ...(listing.price !== undefined ? { price: listing.price } : {}),
      ...(listing.buildArea !== undefined ? { buildArea: listing.buildArea } : {}),
      ...(listing.condition !== undefined ? { condition: listing.condition } : {}),
      ...(listing.certificate !== undefined ? { certificate: listing.certificate } : {}),
      ...(listing.description !== undefined ? { description: listing.description } : {}),
      highlights: listing.highlights,
      photoCount: listing.photos.length,
    }).find((scored) => scored.angle === pkg.angle)?.reasoning;

    const brief: PropertyCreativeBrief = {
      listingId: listing.id,
      listingTitle: listing.title,
      propertyType: listing.propertyType,
      angle: pkg.angle as PropertyCreativeBrief["angle"],
      ...(listing.branchId !== undefined ? { branch: listing.branchId } : {}),
      ...(listing.waNumber !== undefined ? { waNumber: listing.waNumber } : {}),
      ...(listing.highlights.length > 0 ? { highlights: listing.highlights } : {}),
      price: listing.price,
      ...(listing.city !== undefined ? { city: listing.city } : {}),
      ...(angleReasoning !== undefined ? { angleReasoning } : {}),
    };

    const availablePhotos = sourcePhotoUrls.length;
    const decidedFormat = propertyFormatDecider.decideFormat(brief, availablePhotos);
    const imageSpec = propertyFormatDecider.decideImageSpec(brief);
    const videoSpec =
      decidedFormat === CreativeFormat.VIDEO_AND_IMAGES
        ? propertyFormatDecider.decideVideoSpec(brief)
        : undefined;

    const sourcePhotoAvailable = availablePhotos > 0;
    if (!sourcePhotoAvailable) {
      // Kai manual-shoot escalation (`docs/PROMPT-AAOS-KAI-MANUAL-SHOOT-MENU-CLEANUP.md`) — a
      // real, separate, visible-only `agent_activities` row alongside the degraded text-only
      // generation below (unchanged), never instead of it: a manager may still want SOME creative
      // live now while a better one is shot later. Best-effort — `recordManualShootEscalation`
      // never throws, so a resolution/logging failure here can never abort the real generation
      // this method exists to run.
      await this.recordManualShootEscalation(tenantId, listing);
    }
    const videoPrompt =
      videoSpec !== undefined
        ? propertyPromptBuilder.buildVideoPrompt(brief, sourcePhotoAvailable)
        : undefined;
    const imagePrompts = Array.from({ length: imageSpec.count }, (_, index) =>
      propertyPromptBuilder.buildImagePrompt(brief, index),
    );

    const copyResult = propertyCopyBuilder.buildVariants(brief);
    if (!copyResult.ok) {
      await this.repository.fail(id, copyResult.error.message);
      await this.appendLog({
        packageId: id,
        fromAgent: "SYSTEM",
        eventType: "ERROR",
        message: `Brief tidak valid: ${copyResult.error.message}`,
        error: copyResult.error.message,
      });
      throw copyResult.error;
    }
    // AAOS-SAMANTHA-LLM-AD-COPY — real LLM-generated copy is the preferred source; the
    // deterministic `PropertyCopyBuilder` result computed above is kept ONLY as the honest,
    // mandatory fallback (see `buildPropertyCopyVariants`'s own doc for exactly when/why it is
    // used). A package is never left with zero copy: this call always resolves to 3 real variants,
    // one way or the other.
    const copyVariants = await this.buildPropertyCopyVariants(
      tenantId,
      id,
      brief,
      copyResult.value,
      options?.requestedVariantCount,
    );

    await this.appendLog({
      packageId: id,
      fromAgent: pkg.origin === "SAMANTHA" ? "SAMANTHA" : "MANAGER",
      toAgent: "KAI",
      eventType: "BRIEF_SENT",
      message: `Brief ${pkg.angle} untuk listing ${listing.title} dikirim ke Kai.`,
      brief: {
        vertical: "PROPERTY",
        listingId: listing.id,
        listingTitle: listing.title,
        propertyType: listing.propertyType,
        angle: pkg.angle,
        primaryMessage: pkg.primaryMessage,
        requestedFormat: pkg.requestedFormat,
        urgency: pkg.urgency,
        reason: pkg.reason,
        origin: pkg.origin,
      },
    });
    await this.appendLog({
      packageId: id,
      fromAgent: "KAI",
      toAgent: "KIE_AI",
      eventType: "GENERATE",
      message:
        sourcePhotoUrls.length > 0
          ? `Kai mulai generate (${sourcePhotoUrls.length} foto listing tersedia sebagai referensi).`
          : "Kai mulai generate — listing tidak punya foto, Kai generate tanpa foto referensi.",
      metadata: {
        requestedFormat: pkg.requestedFormat,
        sourcePhotosFound: sourcePhotoUrls.length,
        sourcePhotoUrls: [...sourcePhotoUrls],
      },
    });

    const accepted = await this.findOrThrowScoped(tenantId, id);

    // Detached on purpose — not awaited, same discipline as `generate()`'s `runGeneration`.
    // AAOS LOOP UPGRADE, Sprint 8b — `options.qaAndRetry` is set ONLY by
    // `triggerAutoLoopGeneration` (the new real auto-trigger for a `source: 'auto_loop'` DRAFT
    // package). Every pre-existing caller (the manual `POST .../property/:id/generate` endpoint,
    // `create({ generate: true })`) omits it, so this branch is unreachable for them — zero
    // behavior change to the real, already-tested manual pipeline.
    if (options?.qaAndRetry === true) {
      void this.runGenerationPropertyWithQaRetry(
        id,
        tenantId,
        pkg,
        sourcePhotoUrls,
        decidedFormat,
        videoPrompt,
        videoSpec,
        imagePrompts,
        imageSpec,
        copyVariants,
        Date.now(),
        kai,
      );
    } else {
      void this.runGenerationProperty(
        id,
        tenantId,
        sourcePhotoUrls,
        decidedFormat,
        videoPrompt,
        videoSpec,
        imagePrompts,
        imageSpec,
        copyVariants,
        Date.now(),
        kai,
      );
    }

    return toCreativePackageResponseDto(accepted);
  }

  /**
   * AAOS LOOP UPGRADE, Sprint 8b (Prompt 19 Step 4) — the real, honest AUTO-TRIGGER this dispatch
   * adds. Per the user's explicit, informed decision (see this dispatch's own coordinator note): a
   * `source: 'auto_loop'` `creative_packages` row that has reached `DRAFT` — either directly from
   * Sprint 8a's own guardrail chain (LIVE mode + `auto_approve_creative_brief` ON,
   * `decideCreativeBriefGuardrail` returning `status: "DRAFT"`), or via a human approving a
   * `PENDING_REVIEW` row (`PendingActionsService.approve`'s `REVIEW_CREATIVE_BRIEF` branch,
   * `approveReview` moving it `PENDING_REVIEW -> DRAFT`) — is picked up and processed through the
   * REAL Kie AI generation pipeline WITHOUT a further manual `POST .../generate` click.
   *
   * Two real call sites reach this method (both documented in full at their own call site):
   *   1. `SchedulerService.runNeedCreativeCheck`, immediately after inserting a `DRAFT` row (the
   *      guardrail's own auto-approved branch) — the most immediate, honest trigger point (no
   *      separate cron/queue needed; the row is already known-fresh in that same request).
   *   2. `PendingActionsService.approve`, immediately after `approveReview` (the human-approved
   *      branch) — same real reasoning: once a human approves, the brief is functionally ready the
   *      same way an auto-approved DRAFT is, per the spec's own "PENDING atau APPROVED" wording.
   *
   * SAFETY GUARDS (never weakened by this method): only ever runs for `source === 'auto_loop'` —
   * throws for any `manual` row, so a bug in a future caller can never accidentally auto-trigger
   * real Kie AI spend for a package a human never even asked the scheduler to create. Only ever runs
   * for `status === 'DRAFT'` — an already-`GENERATING`/terminal row is rejected by
   * `generateProperty`'s own existing guard.
   */
  async triggerAutoLoopGeneration(
    tenantId: string,
    id: string,
  ): Promise<CreativePackageResponseDto> {
    const pkg = await this.findOrThrowScoped(tenantId, id);
    if (pkg.source !== "auto_loop") {
      throw new ValidationError(
        `Creative package "${id}" has source="${pkg.source}" — triggerAutoLoopGeneration only ever runs for a real, scheduler-inserted "auto_loop" brief, never a manual one.`,
      );
    }
    if (pkg.status !== "DRAFT") {
      throw new ValidationError(
        `Creative package "${id}" is ${pkg.status}; only a DRAFT auto_loop package can be auto-triggered for generation.`,
      );
    }
    return this.generateProperty(tenantId, id, { qaAndRetry: true });
  }

  /**
   * Kai manual-shoot escalation — resolves `listing.branchId`'s real available sales humans (via
   * the globally-provided `BranchManager.getAvailableSales`) and writes ONE real, terminal
   * `agent_activities` row (`agent: "KAI"`, `actionType: "CREATIVE_NEEDS_MANUAL_SHOOT"`,
   * `status: "NEEDS_HUMAN"`) so a manager scanning the Activity Log can see this listing needs a
   * manual photo/video shoot and who to ask.
   *
   * REAL, HONEST LIMITS, documented here rather than silently implied as more than this is:
   * - No real WhatsApp message is sent to any resolved sales human — that needs a real, separately
   *   approved WABA template first (a real external/Meta process, this phase deliberately does not
   *   attempt it). This is a visible-only record.
   * - `@aos/branch-manager`'s `SalesTeamRegistry` (reached here via `BranchManager`) is a
   *   process-local, in-memory registry seeded EMPTY at boot and populated only by
   *   `POST /api/v1/branches/.../sales` (`BranchesService.addSalesHuman`) — NOT by
   *   `SalesHumansService.create`'s durable, Supabase-Auth-backed sales-account provisioning path
   *   (confirmed directly: that service's own class doc calls this the same real, pre-existing gap
   *   "DELIBERATELY OUT OF SCOPE"). So `resolvedSalesHumans` legitimately comes back empty on a
   *   fresh/restarted process even for a branch with real, DB-provisioned sales accounts — an
   *   honest reflection of this registry's real current state, never a fabricated non-empty result.
   * - `listing.branchId` is a free-text optional string (`dto/listing.dto.ts`), not guaranteed to
   *   be one of DSS Motor's 4 automotive `BranchId` members a PROPERTY tenant's own branches may
   *   use different names — an unrecognized/missing value degrades to an empty
   *   `resolvedSalesHumans`, never a fabricated match.
   *
   * Best-effort by construction — `ModeGuardService.resolveMode`/`ActivityLogger.start`/`.escalate`
   * never throw, and `GetAvailableSales.execute` returns `Result<_, never>`, but this is still
   * wrapped end-to-end so a future change to any of those can never turn this side-effect into a
   * reason `generateProperty` itself fails (same discipline `SchedulerService.countHotLeads`/etc.
   * already establish for a side-check that can't take down the main flow).
   */
  private async recordManualShootEscalation(
    tenantId: string,
    listing: ListingResponseDto,
  ): Promise<void> {
    let resolvedSalesHumans: ReadonlyArray<{ readonly name: string; readonly branchId: string }> =
      [];
    try {
      const knownBranchId = toKnownBranchId(listing.branchId);
      if (knownBranchId !== undefined) {
        const result = this.branchManager.getAvailableSales.execute({
          branchId: knownBranchId,
        });
        if (result.ok) {
          resolvedSalesHumans = result.value.map((salesHuman) => ({
            name: salesHuman.name,
            branchId: salesHuman.branchId,
          }));
        }
      }
    } catch (caught) {
      this.logger.warn(
        `CreativePackagesService.recordManualShootEscalation(${listing.id}): sales resolution failed, degrading to an empty list: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
    }

    try {
      const mode = await this.modeGuard.resolveMode(tenantId);
      const activityId = await this.activityLogger.start({
        tenantId,
        agent: "KAI",
        actionType: "CREATIVE_NEEDS_MANUAL_SHOOT",
        mode,
        input: {
          listingId: listing.id,
          listingTitle: listing.title,
          resolvedSalesHumans,
        },
      });
      await this.activityLogger.escalate(activityId);
    } catch (caught) {
      this.logger.warn(
        `CreativePackagesService.recordManualShootEscalation(${listing.id}): writing the NEEDS_HUMAN activity row failed: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
    }
  }

  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — resolves the real `copyVariants` for a PROPERTY package's
   * `generateProperty` run: tries `LlmService.generateAdCopyVariants` first (genuinely varied,
   * LLM-generated Indonesian copy — see that method's own doc), and on ANY failure (`available:
   * false` for whatever reason, or the call itself throwing) falls back HONESTLY to the
   * deterministic `PropertyCopyBuilder` templates already computed by the caller
   * (`deterministicFallback`, `PropertyCopyVariant[]`) — never leaves a package with empty/broken
   * copy. `callToAction` is never asked of the LLM (see `AdCopyVariantsLlmPayloadSchema`'s own
   * doc) — filled in deterministically here from `PropertyCopyBuilder`'s own real 2-CTA
   * vocabulary (`CTA_DIRECT` for A/C, `CTA_LEARN` for B, mirroring that builder's own convention),
   * matched positionally to `deterministicFallback`'s own labels rather than re-declaring a THIRD
   * copy of Meta's real CTA-type string.
   *
   * BULK-PUBLISH WIDENING: `requestedVariantCount` (when set) is threaded straight through as
   * `targetCount`. On an LLM failure the deterministic `PropertyCopyBuilder` fallback still only
   * ever produces its own fixed 3 templates (that builder's hand-authored angles were never
   * designed to scale to N) — an honest degrade to 3 real variants is better than zero, even when a
   * larger count was requested; never a fabricated stretch to N templates that don't exist.
   */
  private async buildPropertyCopyVariants(
    tenantId: string,
    id: string,
    brief: PropertyCreativeBrief,
    deterministicFallback: ReadonlyArray<PropertyCopyVariant>,
    requestedVariantCount?: number,
  ): Promise<readonly StoredCopyVariant[]> {
    try {
      const llmResult = await this.llmService.generateAdCopyVariants(tenantId, {
        listingTitle: brief.listingTitle,
        propertyType: brief.propertyType,
        angle: brief.angle,
        ...(brief.price !== undefined ? { price: brief.price } : {}),
        ...(brief.city !== undefined ? { city: brief.city } : {}),
        ...(brief.highlights !== undefined && brief.highlights.length > 0
          ? { highlights: [...brief.highlights] }
          : {}),
        ...(requestedVariantCount !== undefined ? { targetCount: requestedVariantCount } : {}),
      });
      if (llmResult.available) {
        return llmResult.variants.map((variant) => ({
          id: randomUUID(),
          variantLabel: variant.variantLabel,
          primaryText: variant.primaryText,
          headline: variant.headline,
          callToAction: ctaForVariantLabel(variant.variantLabel),
          description: variant.description,
        }));
      }
      this.logger.warn(
        `CreativePackagesService.buildPropertyCopyVariants(${id}): LLM generation unavailable (${llmResult.reason}), falling back to deterministic PropertyCopyBuilder templates.`,
      );
    } catch (caught) {
      this.logger.warn(
        `CreativePackagesService.buildPropertyCopyVariants(${id}): LLM generation threw, falling back to deterministic PropertyCopyBuilder templates: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
    }
    return deterministicFallback.map(toStoredCopyVariantFromProperty);
  }

  /** The detached PROPERTY pipeline body — real Kie AI calls via the shared `CreativeOrchestratorService`, real GCS persistence of the generated media via the SAME `IAssetStorage` adapter `ListingsService.addPhoto`/`addDocument` already establish bypassing `@aos/asset-library`'s `assets` table (Finding 7 — a generated PROPERTY creative has no `unit_id`/`Branch`-shaped home there either). */
  private async runGenerationProperty(
    id: string,
    tenantId: string,
    sourcePhotoUrls: readonly string[],
    decidedFormat: CreativeFormat,
    videoPrompt: string | undefined,
    videoSpec: VideoSpec | undefined,
    imagePrompts: readonly string[],
    imageSpec: ImageSpec,
    copyVariants: readonly StoredCopyVariant[],
    startedAtMs: number,
    kai: KaiAgentRuntime,
  ): Promise<void> {
    try {
      const orchestrationResult = await kai.orchestratorService.orchestrate({
        sourcePhotoUrls,
        ...(videoPrompt !== undefined ? { videoPrompt } : {}),
        ...(videoSpec !== undefined ? { videoSpec } : {}),
        imagePrompts,
        imageSpec,
        correlationId: id,
      });
      if (!orchestrationResult.ok) {
        await this.recordFailure(id, orchestrationResult.error.message, tenantId);
        return;
      }
      const generated = orchestrationResult.value;

      const persisted = await this.persistGeneratedMedia(tenantId, id, generated);
      if (generated.imageBuffers.length > 0 && persisted.imageUrls.length === 0) {
        await this.recordFailure(
          id,
          "CreativePackagesService: Kie AI generated images but persisting them to storage failed",
          tenantId,
        );
        return;
      }

      const aiModel = describeModel(videoSpec?.model, imageSpec.model);
      const confidenceScore = ConfidenceScore.compute({
        imageUrlCount: persisted.imageUrls.length,
        requestedImageCount: imageSpec.count,
        videoRequested: videoSpec !== undefined,
        videoDelivered: persisted.videoUrl !== undefined,
      });
      const decidedFormatOutcome: CreativePackageFormat =
        decidedFormat === CreativeFormat.VIDEO_AND_IMAGES && persisted.videoUrl !== undefined
          ? "VIDEO_AND_IMAGES"
          : "IMAGES_ONLY";
      const outcome: CreativeGenerationOutcome = {
        decidedFormat: decidedFormatOutcome,
        sourcePhotoUrls,
        ...(persisted.videoUrl !== undefined ? { videoUrl: persisted.videoUrl } : {}),
        imageUrls: persisted.imageUrls,
        copyVariants,
        aiModel,
        confidenceScore: confidenceScore.toNumber(),
        generationMs: Date.now() - startedAtMs,
      };
      await this.repository.complete(id, outcome, new Date().toISOString());
      await this.appendLog({
        packageId: id,
        fromAgent: "KIE_AI",
        toAgent: "KAI",
        eventType: "COMPLETE",
        message: `Selesai: ${outcome.videoUrl !== undefined ? "1 video, " : ""}${String(outcome.imageUrls.length)} gambar, ${String(outcome.copyVariants.length)} varian copy.`,
        result: {
          videoUrl: outcome.videoUrl ?? null,
          imageUrls: [...outcome.imageUrls],
          copyVariants: outcome.copyVariants.map((variant) => ({ ...variant })),
        },
        metadata: {
          decidedFormat: outcome.decidedFormat,
          model: outcome.aiModel ?? null,
          confidenceScore: outcome.confidenceScore ?? null,
          durationMs: outcome.generationMs ?? null,
          sourcePhotoSkippedReason: generated.sourcePhotoSkippedReason ?? null,
        },
      });
      await this.recordAgentRun(id, tenantId);
    } catch (caught) {
      await this.recordFailure(
        id,
        caught instanceof Error ? caught.message : String(caught),
        tenantId,
      );
    }
  }

  /**
   * AAOS LOOP UPGRADE, Sprint 8b (Prompt 19 Step 4c-h) — the real, QA-gated, retrying sibling of
   * `runGenerationProperty`, reached ONLY through `triggerAutoLoopGeneration` (a `source: 'auto_loop'`
   * package). Reuses the exact same real Kie AI call (`kai.orchestratorService.orchestrate`) and the
   * exact same real GCS persistence (`persistGeneratedMedia`) `runGenerationProperty` already uses —
   * no second, parallel Kie AI integration.
   *
   * Step 4c/4d: one real `orchestrate()` call per attempt (Kie AI's own async polling already lives
   * inside `CreativeOrchestratorService.orchestrate` — this method awaits its real result, same as
   * `runGenerationProperty`).
   * Step 4e: `runQaChecks` (`domain/creative-qa.ts`) inspects the REAL returned buffers — real
   * non-zero size, real file-signature, and (for the real JPEG images this pipeline produces) real
   * measured resolution + aspect-ratio vs. the SPECIFIC `imageSpec.aspectRatio` Kai requested (see
   * that module's own doc for exactly what is, and is NOT, honestly checked). A failed orchestration
   * OR a failed QA pass both count as one "attempt" — up to `MAX_GENERATION_ATTEMPTS` (3: 1 initial +
   * 2 retries, the spec's own literal cap) real attempts are made before this method gives up.
   * Step 4f/4g: QA passing writes the SAME real `repository.complete` (`status: "PENDING"`, ready for
   * the existing human review queue) `runGenerationProperty` already writes — "Asset Library" in the
   * spec's own words maps onto this app's real GCS-backed `image_urls`/`video_url` columns (K1/K2's
   * own real, already-established shape — see `creative-package.ts`'s doc), never a fabricated second
   * asset store.
   * Step 4e (failure branch): every attempt exhausted → `recordFailure` (the SAME real
   * `repository.fail` → `status: "FAILED"` `runGenerationProperty`'s own catch block already uses —
   * `FAILED` already exists on `CreativePackageStatus`, no migration needed) — explicitly does NOT
   * proceed to anything resembling Step 5 (no Meta call is ever made anywhere in this class).
   * Step 4h: a real `audit_log` `CREATIVE_GENERATED` row (success OR failure — `after_state` honestly
   * reflects which) and a real `agent_activities` row (`CREATIVE_AUTO_GENERATE`) are written exactly
   * once, describing "Generate creative [angle] untuk brief #[id] (asal: auto_loop)" in real,
   * structured form (`input`/`output` JSON, not a hardcoded narration string — this app's own
   * `agent_activities` convention, matching every other real writer in this file).
   */
  private async runGenerationPropertyWithQaRetry(
    id: string,
    tenantId: string,
    pkg: StoredCreativePackage,
    sourcePhotoUrls: readonly string[],
    decidedFormat: CreativeFormat,
    videoPrompt: string | undefined,
    videoSpec: VideoSpec | undefined,
    imagePrompts: readonly string[],
    imageSpec: ImageSpec,
    copyVariants: readonly StoredCopyVariant[],
    startedAtMs: number,
    kai: KaiAgentRuntime,
  ): Promise<void> {
    const mode: TenantMode = await this.modeGuard.resolveMode(tenantId).catch((caught: unknown) => {
      this.logger.warn(
        `CreativePackagesService.runGenerationPropertyWithQaRetry(${id}): resolveMode failed, tagging DEV: ${String(caught)}`,
      );
      return "DEV";
    });
    const activityId = await this.activityLogger.start({
      tenantId,
      agent: "KAI",
      actionType: "CREATIVE_AUTO_GENERATE",
      mode,
      input: {
        creativePackageId: id,
        angle: pkg.angle,
        source: pkg.source,
        relatedVerdictId: pkg.relatedVerdictId ?? null,
        maxAttempts: MAX_GENERATION_ATTEMPTS,
      },
    });

    const attemptSummaries: string[] = [];
    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      let orchestrationResult: Awaited<
        ReturnType<KaiAgentRuntime["orchestratorService"]["orchestrate"]>
      >;
      try {
        orchestrationResult = await kai.orchestratorService.orchestrate({
          sourcePhotoUrls,
          ...(videoPrompt !== undefined ? { videoPrompt } : {}),
          ...(videoSpec !== undefined ? { videoSpec } : {}),
          imagePrompts,
          imageSpec,
          correlationId: id,
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        attemptSummaries.push(
          `Percobaan ${String(attempt)}: orchestrate melempar error — ${message}`,
        );
        await this.appendLog({
          packageId: id,
          fromAgent: "KIE_AI",
          toAgent: "KAI",
          eventType: "ERROR",
          message: `Generate percobaan ${String(attempt)}/${String(MAX_GENERATION_ATTEMPTS)} gagal (exception): ${message}`,
          error: message,
        });
        continue;
      }

      if (!orchestrationResult.ok) {
        attemptSummaries.push(`Percobaan ${String(attempt)}: ${orchestrationResult.error.message}`);
        await this.appendLog({
          packageId: id,
          fromAgent: "KIE_AI",
          toAgent: "KAI",
          eventType: "ERROR",
          message: `Generate percobaan ${String(attempt)}/${String(MAX_GENERATION_ATTEMPTS)} gagal: ${orchestrationResult.error.message}`,
          error: orchestrationResult.error.message,
        });
        continue;
      }

      const generated = orchestrationResult.value;
      const persisted = await this.persistGeneratedMedia(tenantId, id, generated);
      if (generated.imageBuffers.length > 0 && persisted.imageUrls.length === 0) {
        attemptSummaries.push(
          `Percobaan ${String(attempt)}: Kie AI generate gambar tapi upload ke storage gagal semua.`,
        );
        await this.appendLog({
          packageId: id,
          fromAgent: "KIE_AI",
          toAgent: "KAI",
          eventType: "ERROR",
          message: `Generate percobaan ${String(attempt)}/${String(MAX_GENERATION_ATTEMPTS)} gagal — upload gambar ke storage gagal semua.`,
          error: "persist_images_failed",
        });
        continue;
      }

      const qa = runQaChecks({
        imageBuffers: generated.imageBuffers,
        ...(generated.videoBuffer !== undefined ? { videoBuffer: generated.videoBuffer } : {}),
        requestedImageCount: imageSpec.count,
        imageAspectRatio: imageSpec.aspectRatio,
        videoRequested: videoSpec !== undefined,
      });
      await this.appendLog({
        packageId: id,
        fromAgent: "SYSTEM",
        toAgent: "KAI",
        eventType: qa.passed ? "COMPLETE" : "ERROR",
        message: qa.passed
          ? `QA lolos (percobaan ${String(attempt)}/${String(MAX_GENERATION_ATTEMPTS)}): ${String(qa.checks.length)} pemeriksaan real dijalankan.`
          : `QA gagal (percobaan ${String(attempt)}/${String(MAX_GENERATION_ATTEMPTS)}): ${qa.reasons.join("; ")}`,
        metadata: {
          qaPassed: qa.passed,
          qaChecks: qa.checks.map((check): CreativeLogJson => ({
            check: check.check,
            passed: check.passed,
            detail: check.detail,
          })),
        },
      });

      if (!qa.passed) {
        attemptSummaries.push(`Percobaan ${String(attempt)}: QA gagal — ${qa.reasons.join("; ")}`);
        continue;
      }

      // QA lolos — Step 4f/4g: real completion, the SAME shape `runGenerationProperty` writes.
      const aiModel = describeModel(videoSpec?.model, imageSpec.model);
      const confidenceScore = ConfidenceScore.compute({
        imageUrlCount: persisted.imageUrls.length,
        requestedImageCount: imageSpec.count,
        videoRequested: videoSpec !== undefined,
        videoDelivered: persisted.videoUrl !== undefined,
      });
      const decidedFormatOutcome: CreativePackageFormat =
        decidedFormat === CreativeFormat.VIDEO_AND_IMAGES && persisted.videoUrl !== undefined
          ? "VIDEO_AND_IMAGES"
          : "IMAGES_ONLY";
      const outcome: CreativeGenerationOutcome = {
        decidedFormat: decidedFormatOutcome,
        sourcePhotoUrls,
        ...(persisted.videoUrl !== undefined ? { videoUrl: persisted.videoUrl } : {}),
        imageUrls: persisted.imageUrls,
        copyVariants,
        aiModel,
        confidenceScore: confidenceScore.toNumber(),
        generationMs: Date.now() - startedAtMs,
      };
      await this.repository.complete(id, outcome, new Date().toISOString());
      await this.appendLog({
        packageId: id,
        fromAgent: "KIE_AI",
        toAgent: "KAI",
        eventType: "COMPLETE",
        message: `Selesai (percobaan ${String(attempt)}/${String(MAX_GENERATION_ATTEMPTS)}): ${outcome.videoUrl !== undefined ? "1 video, " : ""}${String(outcome.imageUrls.length)} gambar, ${String(outcome.copyVariants.length)} varian copy.`,
        result: {
          videoUrl: outcome.videoUrl ?? null,
          imageUrls: [...outcome.imageUrls],
          copyVariants: outcome.copyVariants.map((variant) => ({ ...variant })),
        },
        metadata: {
          decidedFormat: outcome.decidedFormat,
          model: outcome.aiModel ?? null,
          confidenceScore: outcome.confidenceScore ?? null,
          durationMs: outcome.generationMs ?? null,
          sourcePhotoSkippedReason: generated.sourcePhotoSkippedReason ?? null,
          attempts: attempt,
        },
      });
      await this.recordAgentRun(id, tenantId);

      // Step 4h — real audit_log write, the real `CREATIVE_GENERATED` action_type
      // `045_audit_log.sql` reserved for exactly this real writer.
      await this.auditLog.record({
        tenantId,
        agent: "KAI",
        actionType: "CREATIVE_GENERATED",
        beforeState: { status: "DRAFT", source: pkg.source, angle: pkg.angle },
        afterState: {
          creativePackageId: id,
          status: "PENDING",
          decidedFormat: outcome.decidedFormat,
          imageCount: outcome.imageUrls.length,
          hasVideo: outcome.videoUrl !== undefined,
          attempts: attempt,
        },
        decidedBy: "ai_auto",
        mode,
        relatedBriefId: id,
        ...(pkg.relatedVerdictId !== undefined ? { relatedVerdictId: pkg.relatedVerdictId } : {}),
        reversible: false,
      });
      await this.activityLogger.complete(activityId, {
        status: "SUCCESS",
        output: {
          creativePackageId: id,
          angle: pkg.angle,
          attempts: attempt,
          imageCount: outcome.imageUrls.length,
          hasVideo: outcome.videoUrl !== undefined,
          message: `Generate creative ${pkg.angle} untuk brief #${id} (asal: ${pkg.source}).`,
        },
      });
      return;
    }

    // Step 4e failure branch — every real attempt exhausted. Real, honest FAILED state; explicitly
    // does NOT proceed to anything resembling Step 5 (no code path here ever calls Meta).
    const message = `Auto-loop generation gagal setelah ${String(MAX_GENERATION_ATTEMPTS)} percobaan real: ${attemptSummaries.join(" | ")}`;
    await this.recordFailure(id, message, tenantId);
    await this.auditLog.record({
      tenantId,
      agent: "KAI",
      actionType: "CREATIVE_GENERATED",
      beforeState: { status: "DRAFT", source: pkg.source, angle: pkg.angle },
      afterState: {
        creativePackageId: id,
        status: "FAILED",
        attempts: MAX_GENERATION_ATTEMPTS,
        attemptSummaries,
      },
      decidedBy: "ai_auto",
      mode,
      relatedBriefId: id,
      ...(pkg.relatedVerdictId !== undefined ? { relatedVerdictId: pkg.relatedVerdictId } : {}),
      reversible: false,
    });
    await this.activityLogger.fail(activityId, new Error(message));
  }

  /**
   * Uploads generated PROPERTY media buffers to real GCS storage via the shared `IAssetStorage`
   * adapter — the SAME `library.assetStorage.upload({path, fileBody, contentType})` call
   * `ListingsService.addPhoto`/`addDocument` already established (Phase 2), bypassing
   * `@aos/asset-library`'s `assets` table/`SaveAiCreative` use case entirely: that use case
   * requires a real `Branch` enum member (AUTOMOTIVE-only), which a PROPERTY package has no honest
   * value for. A failed individual upload is skipped (not thrown) — `runGenerationProperty` decides
   * whether an empty result is a real failure.
   */
  private async persistGeneratedMedia(
    tenantId: string,
    id: string,
    generated: OrchestrateGenerationOutput,
  ): Promise<{ readonly imageUrls: string[]; readonly videoUrl?: string }> {
    if (this.assetLibrary === undefined) {
      return { imageUrls: [] };
    }
    const library = this.assetLibrary;
    const imageUrls: string[] = [];
    for (const [index, buffer] of generated.imageBuffers.entries()) {
      const path = `creative-property/${tenantId}/${id}/image-${String(index + 1)}.jpg`;
      const uploaded = await library.assetStorage.upload({
        path,
        fileBody: buffer,
        contentType: "image/jpeg",
      });
      if (uploaded.ok) {
        imageUrls.push(uploaded.value.publicUrl);
      } else {
        this.logger.warn(
          `CreativePackagesService.persistGeneratedMedia(${id}): image ${String(index + 1)} upload failed: ${uploaded.error.message}`,
        );
      }
    }
    let videoUrl: string | undefined;
    if (generated.videoBuffer !== undefined) {
      const path = `creative-property/${tenantId}/${id}/video.mp4`;
      const uploaded = await library.assetStorage.upload({
        path,
        fileBody: generated.videoBuffer,
        contentType: "video/mp4",
      });
      if (uploaded.ok) {
        videoUrl = uploaded.value.publicUrl;
      } else {
        this.logger.warn(
          `CreativePackagesService.persistGeneratedMedia(${id}): video upload failed: ${uploaded.error.message}`,
        );
      }
    }
    return { imageUrls, ...(videoUrl !== undefined ? { videoUrl } : {}) };
  }

  async approve(
    id: string,
    body: ApprovePackageBodyDto,
    now: Date,
  ): Promise<CreativePackageResponseDto> {
    const existing = await this.findOrThrow(id);
    if (existing.status !== "PENDING") {
      throw new ValidationError(
        `Creative package "${id}" is ${existing.status}; only a PENDING package can be approved`,
      );
    }
    const selected = body.selectedCopyVariantId ?? existing.copyVariants[0]?.id;
    if (
      selected !== undefined &&
      !existing.copyVariants.some((variant) => variant.id === selected)
    ) {
      throw new ValidationError(
        `selectedCopyVariantId "${selected}" is not a copy variant of package "${id}"`,
      );
    }
    await this.repository.review(id, "APPROVED", now.toISOString(), selected);
    await this.appendLog({
      packageId: id,
      fromAgent: "MANAGER",
      toAgent: "SISTEM",
      eventType: "APPROVED",
      message: `Package disetujui manager${selected !== undefined ? ` (copy ${labelOf(existing.copyVariants, selected)})` : ""}.`,
      ...(selected !== undefined ? { metadata: { selectedCopyVariantId: selected } } : {}),
    });
    return toCreativePackageResponseDto(await this.findOrThrow(id));
  }

  async reject(
    id: string,
    body: RejectPackageBodyDto,
    now: Date,
  ): Promise<CreativePackageResponseDto> {
    const existing = await this.findOrThrow(id);
    if (existing.status !== "PENDING") {
      throw new ValidationError(
        `Creative package "${id}" is ${existing.status}; only a PENDING package can be rejected`,
      );
    }
    await this.repository.review(id, "REJECTED", now.toISOString());
    await this.appendLog({
      packageId: id,
      fromAgent: "MANAGER",
      toAgent: "SISTEM",
      eventType: "REJECTED",
      message: `Package ditolak manager${body.reason !== undefined ? `: ${body.reason}` : "."}`,
      ...(body.reason !== undefined ? { metadata: { reason: body.reason } } : {}),
    });
    return toCreativePackageResponseDto(await this.findOrThrow(id));
  }

  /** The detached pipeline body — real Kie AI calls, real asset-library persistence. */
  private async runGeneration(
    id: string,
    brief: CreativeBrief,
    sourcePhotoUrls: readonly string[],
    startedAtMs: number,
    kai: KaiAgentRuntime,
  ): Promise<void> {
    try {
      const result = await kai.processCreativeBrief.execute(brief);
      if (!result.ok) {
        await this.recordFailure(id, result.error.message, this.tenantId);
        return;
      }
      const pkg = result.value;
      // Every field below is READ off the real returned `CreativePackage` — the model strings are
      // the actual `VideoModel`/`ImageModel` enum values Kai's `FormatDecider` chose
      // (`veo3_fast`/`veo3` and `nano-banana-pro`), never a hardcoded label.
      const decidedFormat: CreativePackageFormat =
        pkg.videoUrl !== undefined ? "VIDEO_AND_IMAGES" : "IMAGES_ONLY";
      const aiModel = describeModel(pkg.videoSpec?.model, pkg.imageSpecs[0]?.model);
      const outcome: CreativeGenerationOutcome = {
        decidedFormat,
        sourcePhotoUrls,
        ...(pkg.videoUrl !== undefined ? { videoUrl: pkg.videoUrl } : {}),
        imageUrls: [...pkg.imageUrls],
        copyVariants: pkg.copyVariants.map(toStoredCopyVariant),
        ...(aiModel !== undefined ? { aiModel } : {}),
        confidenceScore: pkg.confidenceScore.toNumber(),
        generationMs: pkg.totalGenerationMs ?? Date.now() - startedAtMs,
      };
      await this.repository.complete(id, outcome, new Date().toISOString());
      await this.appendLog({
        packageId: id,
        fromAgent: "KIE_AI",
        toAgent: "KAI",
        eventType: "COMPLETE",
        message: `Selesai: ${outcome.videoUrl !== undefined ? "1 video, " : ""}${String(outcome.imageUrls.length)} gambar, ${String(outcome.copyVariants.length)} varian copy.`,
        result: {
          videoUrl: outcome.videoUrl ?? null,
          imageUrls: [...outcome.imageUrls],
          copyVariants: outcome.copyVariants.map((variant) => ({ ...variant })),
        },
        metadata: {
          decidedFormat: outcome.decidedFormat,
          model: outcome.aiModel ?? null,
          confidenceScore: outcome.confidenceScore ?? null,
          durationMs: outcome.generationMs ?? null,
          // REAL BUG FIX: names exactly why a real, found source photo never reached Kie AI (fetch
          // failure, non-2xx response, Kie AI upload rejection, ...) instead of silently degrading
          // to text-only generation with no trace anywhere of why. `null` when a photo either
          // wasn't available at all or was genuinely delivered — never fabricated.
          sourcePhotoSkippedReason: pkg.sourcePhotoSkippedReason ?? null,
        },
      });
      await this.recordAgentRun(id, this.tenantId);
    } catch (caught) {
      await this.recordFailure(
        id,
        caught instanceof Error ? caught.message : String(caught),
        this.tenantId,
      );
    }
  }

  /**
   * AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) — the ONE real helper both `runGeneration` (AUTOMOTIVE
   * success) and `runGenerationProperty` (PROPERTY success) call directly, and `recordFailure`
   * (below, shared by every failure path in both) calls too — so a real `agent_runs` row is
   * recorded exactly once per real generation completion, success OR failure, from a single real
   * shape (never 2 drifted copies). Re-reads the freshly-persisted row (`findOrThrowScoped`) rather
   * than threading yet another parameter through both pipelines' already-long signatures — this
   * runs AFTER `repository.complete`/`repository.fail` has already written the terminal state, so
   * the read is always honestly fresh. `context` is a small, judge-prompt-sized summary — angle,
   * requested vs. decided format, status, copy-variant count, model, confidence, and (only when
   * genuinely present) the real error message — never a full duplicate of the row's image/video
   * URLs or copy text. Best-effort: a failure here (including the read itself) is caught and
   * warned, never rethrown — `AgentRunsService.record` is already best-effort on its own write, but
   * `findOrThrowScoped` is a real read that can itself throw (e.g. a race with a delete), so this
   * wrapper's own try/catch is what actually guarantees "never aborts the real Kai generation" end
   * to end.
   *
   * AAOS-AI-JUDGE-SELF-IMPROVING (Phase J2) — right after the real `agent_runs` row is recorded,
   * this ALSO awaits `AiJudgeService.judgeRun` directly (synchronous within this method), unlike
   * `SchedulerService`/`ClosingsService`'s own J2 wiring, which both detach it. The real, honest
   * reason: `runGeneration`/`runGenerationProperty` are ALREADY started detached from the real HTTP
   * caller (`void this.runGeneration(...)`/`void this.runGenerationProperty(...)`, both above) —
   * nothing is ever waiting synchronously on this method's own completion, so awaiting `judgeRun`
   * here adds real LLM latency only to an already-backgrounded job, never to a real request/response
   * cycle. Awaiting keeps this one helper's control flow simple (one `try` covers both writes) with
   * no loss of the "never blocks a real caller" property J2's coordinator note asks for.
   */
  private async recordAgentRun(id: string, tenantId: string): Promise<void> {
    try {
      const pkg = await this.findOrThrowScoped(tenantId, id);
      const agentRunId = await this.agentRunsService.record(tenantId, "KAI", pkg.id, {
        vertical: pkg.vertical,
        angle: pkg.angle,
        requestedFormat: pkg.requestedFormat,
        decidedFormat: pkg.decidedFormat ?? null,
        status: pkg.status,
        copyVariantCount: pkg.copyVariants.length,
        aiModel: pkg.aiModel ?? null,
        confidenceScore: pkg.confidenceScore ?? null,
        ...(pkg.errorMessage !== undefined ? { errorMessage: pkg.errorMessage } : {}),
      });
      if (agentRunId !== undefined) {
        await this.aiJudgeService.judgeRun(tenantId, agentRunId);
      }
    } catch (caught) {
      this.logger.warn(`CreativePackagesService.recordAgentRun(${id}) failed: ${String(caught)}`);
    }
  }

  private async recordFailure(id: string, message: string, tenantId: string): Promise<void> {
    this.logger.error(`CreativePackagesService.runGeneration(${id}) failed: ${message}`);
    try {
      await this.repository.fail(id, message);
    } catch (caught) {
      // Nothing left to escalate to on the failure path itself.
      this.logger.error(`CreativePackagesService.fail failed for ${id}: ${String(caught)}`);
    }
    await this.appendLog({
      packageId: id,
      fromAgent: "KIE_AI",
      toAgent: "KAI",
      eventType: "ERROR",
      message: `Generate gagal: ${message}`,
      error: message,
    });
    await this.recordAgentRun(id, tenantId);
  }

  /**
   * Reads the REAL `@aos/asset-library` photos for this unit. Returns `[]` (a real, meaningful
   * state — "no scraped photos for this unit") when the library isn't configured or the query
   * fails; a log-side detail must never abort a generation the manager already authorised.
   */
  private async findSourcePhotoUrls(unitId: string): Promise<readonly string[]> {
    if (this.assetLibrary === undefined) {
      return [];
    }
    const found = await this.assetLibrary.getAssetsByUnit.execute({ unitId });
    if (!found.ok) {
      this.logger.warn(
        `CreativePackagesService: source-photo lookup for "${unitId}" failed: ${found.error.message}`,
      );
      return [];
    }
    return found.value.assets.map((asset) => asset.publicUrl.toString());
  }

  private requireKai(): KaiAgentRuntime {
    if (this.kai === undefined) {
      throw new UnavailableError(
        "Kai (creative generation) is not configured on this deployment — set KIE_AI_API_KEY and " +
          "the GCS_* asset-library variables to enable POST /api/v1/creative-packages/:id/generate.",
      );
    }
    return this.kai;
  }

  private async findOrThrow(id: string): Promise<StoredCreativePackage> {
    const pkg = await this.repository.findById(this.tenantId, id);
    if (pkg === undefined) {
      throw new NotFoundError(`No creative package found with id "${id}"`);
    }
    return pkg;
  }

  /**
   * The PROPERTY sibling to `findOrThrow` — scoped to the real, per-request `tenantId` (from
   * `@TenantId()`) rather than `this.config.AAOS_TENANT_ID`, since `createProperty`/
   * `generateProperty` persist PROPERTY rows under the caller's real tenant, matching
   * `ListingsService`'s own tenant-isolation convention.
   */
  private async findOrThrowScoped(tenantId: string, id: string): Promise<StoredCreativePackage> {
    const pkg = await this.repository.findById(tenantId, id);
    if (pkg === undefined) {
      throw new NotFoundError(`No creative package found with id "${id}"`);
    }
    return pkg;
  }

  /** A failed log write must never abort the pipeline or a human's approve/reject. */
  private async appendLog(
    input: Omit<Parameters<CreativeLogRepository["append"]>[0], "tenantId">,
  ): Promise<void> {
    try {
      await this.logRepository.append(
        { ...input, tenantId: this.tenantId },
        new Date().toISOString(),
      );
    } catch (caught) {
      this.logger.warn(`CreativePackagesService.appendLog failed: ${String(caught)}`);
    }
  }
}

/**
 * `listing.branchId` is a free-text optional string (`dto/listing.dto.ts`'s `z.string().min(1)`),
 * NOT guaranteed to be one of DSS Motor's 4 automotive `BranchId` enum members — a PROPERTY
 * tenant's own branches may use entirely different names. Case-insensitive match against the real
 * `BranchId` enum values; `undefined` for anything unrecognized or missing, never a fabricated
 * guess.
 */
function toKnownBranchId(branchId: string | undefined): BranchId | undefined {
  if (branchId === undefined) {
    return undefined;
  }
  const candidate = branchId.toUpperCase();
  return (Object.values(BranchId) as readonly string[]).includes(candidate)
    ? (candidate as BranchId)
    : undefined;
}

function defaultReason(origin: "MANUAL" | "SAMANTHA"): string {
  return origin === "SAMANTHA"
    ? "Disetujui manager dari rekomendasi Samantha."
    : "Brief manual dibuat manager.";
}

function labelOf(variants: readonly StoredCopyVariant[], id: string): string {
  return variants.find((variant) => variant.id === id)?.variantLabel ?? id;
}

/**
 * The real brief fields, as persisted — no field is invented for the log. AUTOMOTIVE-only caller
 * (`generate()`, guarded to `pkg.vertical === "AUTOMOTIVE"`); `unit`/`branch`/`targetPersona` are
 * `null`-coalesced only for `CreativeLogJson`'s type (no `undefined` member), never actually
 * `undefined` at this real call site.
 */
function briefToJson(pkg: StoredCreativePackage): CreativeLogJson {
  return {
    unit: pkg.unit ?? null,
    unitModel: pkg.unitModel ?? null,
    branch: pkg.branch ?? null,
    angle: pkg.angle,
    targetPersona: pkg.targetPersona ?? null,
    primaryMessage: pkg.primaryMessage,
    requestedFormat: pkg.requestedFormat,
    urgency: pkg.urgency,
    reason: pkg.reason,
    origin: pkg.origin,
  };
}

/**
 * AAOS-SAMANTHA-LLM-AD-COPY — the real CTA text `buildPropertyCopyVariants` applies to an
 * LLM-generated variant, mirroring `PropertyCopyBuilder`'s own real A/C="Tanya Sekarang"/
 * B="Pelajari Selanjutnya" convention (that builder's `CTA_DIRECT`/`CTA_LEARN` constants are not
 * exported, so this is a small, deliberately duplicated local constant — same "small deterministic
 * constant stays local to each real caller" discipline `MAX_SOURCE_PHOTOS` above already
 * documents), never an LLM-invented CTA string Meta might not support as a real
 * `call_to_action.type`.
 */
function ctaForVariantLabel(variantLabel: string): string {
  return variantLabel === "B" ? "Pelajari Selanjutnya" : "Tanya Sekarang";
}

function toStoredCopyVariantFromProperty(variant: PropertyCopyVariant): StoredCopyVariant {
  return {
    id: variant.id,
    variantLabel: variant.variantLabel,
    primaryText: variant.primaryText,
    headline: variant.headline,
    callToAction: variant.callToAction,
  };
}

function toStoredCopyVariant(variant: CopyVariant): StoredCopyVariant {
  return {
    id: variant.id,
    variantLabel: variant.variantLabel,
    primaryText: variant.primaryText,
    headline: variant.headline,
    callToAction: variant.callToAction,
  };
}

/**
 * The real Kie AI model string for this run, joined the same way `KaiAgentService.describeModel`
 * joins it for `SaveAiCreative` (`"<video>+<image>"`, or the image model alone when no video was
 * delivered). `undefined` only when the package carries neither spec.
 */
function describeModel(videoModel?: string, imageModel?: string): string | undefined {
  if (videoModel !== undefined && imageModel !== undefined) {
    return `${videoModel}+${imageModel}`;
  }
  return imageModel ?? videoModel;
}
