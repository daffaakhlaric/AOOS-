import { randomUUID } from "node:crypto";

import { PropertyAdAngle } from "@aos/creative-agent";
import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";

import { GrowthPolicyService } from "../automation-policy/growth-policy.service.js";
import { ListingsService } from "../listings/listings.service.js";
import { LlmService } from "../llm/llm.service.js";

import { selectKaiPipeline } from "./domain/kai-pipeline-registry.js";
import { EnqueueKaiJobsSchema } from "./dto/kai-generation.dto.js";
import { CreativeHandoffRepository } from "./infrastructure/creative-handoff.repository.js";

/** Plans inside the existing package inventory. No KIE request or generated-media claim. */
@Injectable()
export class KaiPlanningService {
  constructor(
    private readonly repository: CreativeHandoffRepository,
    private readonly llm: LlmService,
    private readonly listings: ListingsService,
    @Optional() private readonly growthPolicy?: GrowthPolicyService,
  ) {}

  async get(tenant: string, projectId: string) {
    const { brief } = await this.repository.getProject(tenant, projectId);
    return this.repository.getConcepts(tenant, projectId, brief.briefId);
  }

  async generate(tenant: string, projectId: string) {
    const { project, brief } = await this.repository.getProject(tenant, projectId);
    if (project.status === "NEEDS_INPUT" || !brief.listingId)
      throw new BadRequestException("Brief belum lengkap.");
    const existing = await this.repository.getConcepts(tenant, projectId, brief.briefId);
    if (existing.length) return existing;
    const listing = await this.listings.getById(tenant, brief.listingId);
    if (!listing.photos.length)
      throw new BadRequestException("Tambahkan foto sumber listing sebelum membuat konsep.");
    const formats = brief.formats.flatMap((f) => Array.from({ length: f.quantity }, () => f));
    const growth = await this.growthPolicy?.current(tenant);
    const creative = growth?.version ? growth.policy.creativePolicy : undefined;
    if (
      creative &&
      formats.some(
        (f) =>
          !(f.type === "IMAGE"
            ? creative.allowImage
            : f.type === "VIDEO"
              ? creative.allowVideo
              : creative.allowCarousel),
      )
    )
      throw new BadRequestException(
        "Format brief dinonaktifkan oleh Growth Settings. Perbarui brief terlebih dahulu.",
      );
    const duration = creative?.preferredDurationSeconds ?? 15;
    const result = await this.llm.generateKaiConceptPlan(tenant, {
      ...brief,
      ...(creative ? { growthPolicyVersion: growth!.version, creativePolicy: creative } : {}),
      outputSlots: formats.map((f, index) => ({
        index,
        format: f.type,
        sceneCount: f.type === "IMAGE" ? 1 : 5,
      })),
    });
    if (!result.available)
      throw new ServiceUnavailableException(
        `Konsep AI belum tersedia (${result.reason}). Tidak ada konsep buatan yang disimpan.`,
      );
    const plans = result.plan.concepts;
    if (
      plans.length !== formats.length ||
      new Set(plans.map((c) => c.family)).size < Math.min(3, plans.length)
    )
      throw new ServiceUnavailableException(
        "Konsep AI belum memenuhi jumlah atau keragaman brief. Coba lagi.",
      );
    // Existing package inventory accepts this closed enum; the precise family lives on the concept.
    const angles = {
      LOCATION: PropertyAdAngle.VIRTUAL_TOUR,
      PRICE_VALUE: PropertyAdAngle.VIRTUAL_TOUR,
      LIFESTYLE: PropertyAdAngle.VIRTUAL_TOUR,
      PROPERTY_FEATURES: PropertyAdAngle.VIRTUAL_TOUR,
      WALKTHROUGH: PropertyAdAngle.VIRTUAL_TOUR,
      INVESTMENT: PropertyAdAngle.INVESTASI,
    };
    const concepts = plans.map((plan, ordinal) => {
      const format = formats[ordinal]!;
      if (
        [...plan.claimIndices, ...plan.scenes.map((s) => s.claimIndex)].some(
          (i) => !brief.factualClaims[i],
        )
      )
        throw new ServiceUnavailableException("Konsep AI merujuk fakta yang tidak tersedia.");
      if (
        (format.type === "IMAGE" && plan.scenes.length !== 1) ||
        (format.type !== "IMAGE" && plan.scenes.length < 3)
      )
        throw new ServiceUnavailableException("Struktur scene tidak sesuai format brief.");
      const facts = plan.claimIndices.map((i) => brief.factualClaims[i]!);
      return {
        ...plan,
        id: randomUUID(),
        ordinal,
        format: format.type,
        productionPipeline: selectKaiPipeline(format.type, listing.photos.length),
        aspectRatios: format.aspectRatios,
        legacyAngle: angles[plan.family],
        message: facts.map((f) => f.text).join(" · "),
        factualClaims: facts,
        sourceUrls: listing.photos.map((p) => p.url),
        method: "LLM",
        ...(creative ? { growthPolicyVersion: growth!.version, creativePolicy: creative } : {}),
        qaStatus: "NOT_RUN",
        storyboard: {
          id: randomUUID(),
          format: format.type,
          durationSeconds: format.type === "VIDEO" ? duration : null,
          scenes: plan.scenes.map((scene, index) => ({
            ...scene,
            id: randomUUID(),
            ordinal: index,
            sourceUrl:
              format.type === "IMAGE"
                ? (listing.photos.find((p) => p.isMain)?.url ?? listing.photos[0]!.url)
                : listing.photos[index % listing.photos.length]!.url,
            ...(format.type === "VIDEO" ? { productionMethod: "SOURCE_MOTION" } : {}),
            overlayText: brief.factualClaims[scene.claimIndex]!.text,
            provenance: brief.factualClaims[scene.claimIndex],
            startSeconds: format.type === "VIDEO" ? (duration * index) / plan.scenes.length : null,
            endSeconds:
              format.type === "VIDEO" ? (duration * (index + 1)) / plan.scenes.length : null,
            CTA: index === plan.scenes.length - 1 ? brief.CTA : null,
          })),
        },
      };
    });
    await this.repository.ensureConcepts(tenant, projectId, brief.briefId, concepts);
    return this.repository.getConcepts(tenant, projectId, brief.briefId);
  }

  async enqueue(
    tenant: string,
    projectId: string,
    conceptIds: string[],
    renderMode: "FULL" | "SAMPLE" = "FULL",
    reviewedRevisions?: Record<string, number>,
  ) {
    if (renderMode === "SAMPLE" && conceptIds.length !== 1)
      throw new BadRequestException("Sample hanya untuk satu konsep.");
    if (!EnqueueKaiJobsSchema.safeParse({ conceptIds }).success)
      throw new BadRequestException("Pilih 1–10 konsep unik dengan ID valid.");
    const concepts = await this.get(tenant, projectId);
    const growth = await this.growthPolicy?.current(tenant);
    if (growth?.version) {
      if (growth.policy.safetyPolicy.killSwitch)
        throw new BadRequestException("Growth Settings menghentikan produksi baru.");
      for (const selected of concepts.filter((c) => conceptIds.includes(c.id))) {
        const data = selected as Record<string, unknown>;
        // Revalidate legacy and existing concepts against the current format permissions.
        // Enqueue does not confer publication approval; worker-time version checks remain separate.
        const c = growth.policy.creativePolicy;
        if (
          !(data.format === "IMAGE"
            ? c.allowImage
            : data.format === "VIDEO"
              ? c.allowVideo
              : data.format === "CAROUSEL" && c.allowCarousel)
        )
          throw new BadRequestException("Format creative tidak diizinkan Growth Settings.");
      }
    }
    const allowed = new Set(concepts.map((c: { id: string }) => c.id));
    if (!conceptIds.length || conceptIds.some((id) => !allowed.has(id)))
      throw new BadRequestException("Concept tidak berasal dari proyek ini.");
    if (
      !reviewedRevisions ||
      conceptIds.some(
        (id) => !Number.isInteger(reviewedRevisions[id]) || reviewedRevisions[id]! < 1,
      )
    )
      throw new BadRequestException("Muat ulang dan tinjau versi storyboard sebelum produksi.");
    return this.repository.enqueueReviewed(
      tenant,
      projectId,
      conceptIds,
      reviewedRevisions,
      renderMode,
    );
  }

  jobs(tenant: string, projectId: string) {
    return this.repository.listJobs(tenant, projectId);
  }
}
