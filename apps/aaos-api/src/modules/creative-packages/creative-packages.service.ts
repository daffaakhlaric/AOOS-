import { randomUUID } from "node:crypto";

import type { AssetLibrary } from "@aos/asset-library";
import type { CopyVariant, KaiAgentRuntime } from "@aos/creative-agent";
import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { CreativeBrief, CreativeBriefId } from "@aos/meta-ads-agent";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, ASSET_LIBRARY, KAI_AGENT_RUNTIME } from "../../di-tokens.js";

import { buildCreativeBrief } from "./domain/creative-brief.factory.js";
import type { CreativeLogJson } from "./domain/creative-log.js";
import type {
  CreativeGenerationOutcome,
  CreativePackageFormat,
  StoredCopyVariant,
  StoredCreativePackage,
} from "./domain/creative-package.js";
import type {
  CreatePackageBodyDto,
  GetLogsQueryDto,
  GetPackagesQueryDto,
} from "./dto/create-package.dto.js";
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
    private readonly repository: CreativePackageRepository,
    private readonly logRepository: CreativeLogRepository,
  ) {}

  private get tenantId(): string {
    return this.config.AAOS_TENANT_ID;
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
        await this.recordFailure(id, result.error.message);
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
    } catch (caught) {
      await this.recordFailure(id, caught instanceof Error ? caught.message : String(caught));
    }
  }

  private async recordFailure(id: string, message: string): Promise<void> {
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

function defaultReason(origin: "MANUAL" | "SAMANTHA"): string {
  return origin === "SAMANTHA"
    ? "Disetujui manager dari rekomendasi Samantha."
    : "Brief manual dibuat manager.";
}

function labelOf(variants: readonly StoredCopyVariant[], id: string): string {
  return variants.find((variant) => variant.id === id)?.variantLabel ?? id;
}

/** The real brief fields, as persisted — no field is invented for the log. */
function briefToJson(pkg: StoredCreativePackage): CreativeLogJson {
  return {
    unit: pkg.unit,
    unitModel: pkg.unitModel ?? null,
    branch: pkg.branch,
    angle: pkg.angle,
    targetPersona: pkg.targetPersona,
    primaryMessage: pkg.primaryMessage,
    requestedFormat: pkg.requestedFormat,
    urgency: pkg.urgency,
    reason: pkg.reason,
    origin: pkg.origin,
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
