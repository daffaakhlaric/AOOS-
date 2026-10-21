import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  CreateCreativePackageInput,
  CreativeGenerationOutcome,
  CreativePackageCampaignPublishStatus,
  CreativePackageFatigueStatus,
  CreativePackageFormat,
  CreativePackageOrigin,
  CreativePackagePriority,
  CreativePackageSource,
  CreativePackageStatus,
  CreativePackageUrgency,
  CreativePackageVertical,
  StoredCopyVariant,
  StoredCreativePackage,
} from "../domain/creative-package.js";

const TABLE = "creative_packages";

/**
 * Raw `creative_packages` row shape (snake_case) — COLUMN-FOR-COLUMN with
 * `supabase/migrations/003_creative_packages.sql`. Adding a column in one place without the other
 * is the exact class of mismatch that produced two real bugs earlier in this codebase's history;
 * both files cross-reference each other for that reason.
 */
export interface CreativePackageRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly brief_id: string;
  readonly ad_id: string | null;
  readonly stable_id: string | null;
  /** Additive, `026_creative_packages_property.sql`. Defaults to `'AUTOMOTIVE'` at the DB layer for every pre-existing row. */
  readonly vertical: string;
  readonly listing_id: string | null;
  readonly branch: string | null;
  readonly unit: string | null;
  readonly unit_model: string | null;
  readonly title: string;
  readonly angle: string;
  readonly target_persona: string | null;
  readonly reason: string;
  readonly requested_format: string;
  readonly decided_format: string | null;
  readonly primary_message: string;
  readonly urgency: string;
  readonly origin: string;
  readonly status: string;
  /** Additive, `042_creative_packages_ai_recommended.sql`. Defaults to `false` at the DB layer for every pre-existing row. */
  readonly ai_recommended: boolean;
  /** Additive, `044_creative_packages_fatigue.sql`. Defaults to `'NORMAL'` at the DB layer for every pre-existing row. */
  readonly fatigue_status: string;
  /** Additive, `047_creative_packages_auto_loop.sql`. Defaults to `'manual'` at the DB layer for every pre-existing row. */
  readonly source: string;
  readonly related_verdict_id: string | null;
  /** Additive, `047_creative_packages_auto_loop.sql`. Defaults to `'MEDIUM'` at the DB layer for every pre-existing row. */
  readonly priority: string;
  readonly source_photo_urls: readonly string[];
  readonly video_url: string | null;
  readonly image_urls: readonly string[];
  readonly copy_variants: readonly StoredCopyVariant[];
  readonly ai_model: string | null;
  readonly confidence_score: number | null;
  readonly generation_ms: number | null;
  readonly selected_copy_variant_id: string | null;
  readonly error_message: string | null;
  readonly generated_at: string | null;
  readonly reviewed_at: string | null;
  /** Additive, `048_campaign_auto_publish.sql`. NULL for every pre-existing row and every row not yet considered by Step 5's real campaign-publish check. */
  readonly campaign_publish_status: string | null;
  /** Additive, `052_creative_packages_published_ad_ids.sql`. NULL for every pre-existing row and every row never published as a real, non-simulated Meta ad. */
  readonly published_meta_ad_ids: readonly string[] | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export class CreativePackageRepositoryError extends Error {}

function toDomain(row: CreativePackageRow): StoredCreativePackage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    briefId: row.brief_id,
    ...(row.ad_id !== null ? { adId: row.ad_id } : {}),
    ...(row.stable_id !== null ? { stableId: row.stable_id } : {}),
    vertical: row.vertical as CreativePackageVertical,
    ...(row.listing_id !== null ? { listingId: row.listing_id } : {}),
    ...(row.branch !== null ? { branch: row.branch } : {}),
    ...(row.unit !== null ? { unit: row.unit } : {}),
    ...(row.unit_model !== null ? { unitModel: row.unit_model } : {}),
    title: row.title,
    angle: row.angle,
    ...(row.target_persona !== null ? { targetPersona: row.target_persona } : {}),
    reason: row.reason,
    requestedFormat: row.requested_format as CreativePackageFormat,
    ...(row.decided_format !== null
      ? { decidedFormat: row.decided_format as CreativePackageFormat }
      : {}),
    primaryMessage: row.primary_message,
    urgency: row.urgency as CreativePackageUrgency,
    origin: row.origin as CreativePackageOrigin,
    status: row.status as CreativePackageStatus,
    aiRecommended: row.ai_recommended,
    fatigueStatus: row.fatigue_status as CreativePackageFatigueStatus,
    source: row.source as CreativePackageSource,
    ...(row.related_verdict_id !== null ? { relatedVerdictId: row.related_verdict_id } : {}),
    priority: row.priority as CreativePackagePriority,
    sourcePhotoUrls: row.source_photo_urls ?? [],
    ...(row.video_url !== null ? { videoUrl: row.video_url } : {}),
    imageUrls: row.image_urls ?? [],
    copyVariants: row.copy_variants ?? [],
    ...(row.ai_model !== null ? { aiModel: row.ai_model } : {}),
    ...(row.confidence_score !== null ? { confidenceScore: row.confidence_score } : {}),
    ...(row.generation_ms !== null ? { generationMs: row.generation_ms } : {}),
    ...(row.selected_copy_variant_id !== null
      ? { selectedCopyVariantId: row.selected_copy_variant_id }
      : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
    ...(row.generated_at !== null ? { generatedAt: row.generated_at } : {}),
    ...(row.reviewed_at !== null ? { reviewedAt: row.reviewed_at } : {}),
    ...(row.campaign_publish_status !== null
      ? {
          campaignPublishStatus:
            row.campaign_publish_status as CreativePackageCampaignPublishStatus,
        }
      : {}),
    ...(row.published_meta_ad_ids !== null
      ? { publishedMetaAdIds: row.published_meta_ad_ids }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Supabase-backed persistence for `creative_packages` (AAOS-CREATIVE-REVIEW), built on the same
 * hand-rolled `SupabaseClientLike` port `@aos/lead-store`'s own repositories use and sharing the
 * SAME client `app.module.ts` builds (`SUPABASE_CLIENT` DI token) — not a second connection.
 *
 * Mirrors `modules/scraper/infrastructure/scrape-job.repository.ts` method-for-method. Every read
 * is `tenant_id`-scoped (Constitution §6.7).
 */
export class CreativePackageRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async productionFormats(
    tenantId: string,
    ids: string[],
  ): Promise<Map<string, "IMAGE" | "VIDEO" | "CAROUSEL">> {
    if (!ids.length) return new Map();
    type ConceptRow = { id: string; data: { format?: string } };
    type Filter = {
      in(
        column: string,
        values: string[],
      ): PromiseLike<{ data: ConceptRow[] | null; error: { message: string } | null }>;
    };
    const query = this.client
      .from<ConceptRow>("kai_concepts")
      .select("id,data")
      .eq("tenant_id", tenantId) as unknown as Filter;
    const { data, error } = await query.in("id", ids);
    if (error) throw new Error("Production format metadata could not be loaded");
    const formats = new Map<string, "IMAGE" | "VIDEO" | "CAROUSEL">();
    for (const row of data ?? []) {
      const format = row.data.format;
      if (format === "IMAGE" || format === "VIDEO" || format === "CAROUSEL")
        formats.set(row.id, format);
    }
    return formats;
  }

  async create(input: CreateCreativePackageInput): Promise<StoredCreativePackage> {
    // `created_at`/`updated_at` are written explicitly rather than left to the column defaults so
    // the row this method SELECTs back always carries them (and so both timestamps agree exactly on
    // insert), matching `CreativeLogRepository.append`'s convention.
    const createdAt = new Date().toISOString();
    const { data, error } = await this.client
      .from<CreativePackageRow>(TABLE)
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        brief_id: input.briefId,
        ad_id: input.adId ?? null,
        stable_id: input.stableId ?? null,
        vertical: input.vertical,
        listing_id: input.listingId ?? null,
        branch: input.branch ?? null,
        unit: input.unit ?? null,
        unit_model: input.unitModel ?? null,
        title: input.title,
        angle: input.angle,
        target_persona: input.targetPersona ?? null,
        reason: input.reason,
        requested_format: input.requestedFormat,
        primary_message: input.primaryMessage,
        urgency: input.urgency,
        origin: input.origin,
        ai_recommended: input.aiRecommended ?? false,
        fatigue_status: "NORMAL",
        source: input.source ?? "manual",
        related_verdict_id: input.relatedVerdictId ?? null,
        priority: input.priority ?? "MEDIUM",
        status: input.initialStatus ?? "DRAFT",
        source_photo_urls: [],
        image_urls: [],
        copy_variants: [],
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new CreativePackageRepositoryError(
        `CreativePackageRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return toDomain(data);
  }

  async findById(tenantId: string, id: string): Promise<StoredCreativePackage | undefined> {
    const { data, error } = await this.client
      .from<CreativePackageRow>(TABLE)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new CreativePackageRepositoryError(
        `CreativePackageRepository.findById failed: ${error.message}`,
      );
    }
    return data === null ? undefined : toDomain(data);
  }

  /** Newest first. `status` narrows to one lifecycle state (the tabs' own queries). */
  async list(
    tenantId: string,
    options: { readonly status?: CreativePackageStatus; readonly limit?: number } = {},
  ): Promise<readonly StoredCreativePackage[]> {
    let query = this.client.from<CreativePackageRow>(TABLE).select("*").eq("tenant_id", tenantId);
    if (options.status !== undefined) {
      query = query.eq("status", options.status);
    }
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 100);
    if (error !== null) {
      throw new CreativePackageRepositoryError(
        `CreativePackageRepository.list failed: ${error.message}`,
      );
    }
    return (data ?? []).map(toDomain);
  }

  /** Marks a `DRAFT` as `GENERATING` and records the real source photos found for its unit. */
  async markGenerating(id: string, sourcePhotoUrls: readonly string[]): Promise<void> {
    await this.patch(id, "markGenerating", {
      status: "GENERATING",
      source_photo_urls: sourcePhotoUrls,
      error_message: null,
    });
  }

  /** Lands a REAL `ProcessCreativeBrief` result — every field measured, none defaulted or guessed. */
  async complete(
    id: string,
    outcome: CreativeGenerationOutcome,
    generatedAt: string,
  ): Promise<void> {
    await this.patch(id, "complete", {
      status: "PENDING",
      decided_format: outcome.decidedFormat,
      source_photo_urls: outcome.sourcePhotoUrls,
      video_url: outcome.videoUrl ?? null,
      image_urls: outcome.imageUrls,
      copy_variants: outcome.copyVariants,
      ai_model: outcome.aiModel ?? null,
      confidence_score: outcome.confidenceScore ?? null,
      generation_ms: outcome.generationMs ?? null,
      generated_at: generatedAt,
    });
  }

  async fail(id: string, errorMessage: string): Promise<void> {
    await this.patch(id, "fail", { status: "FAILED", error_message: errorMessage });
  }

  /** AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — the real fatigue-status write, called from `SchedulerService.runFatigueCheck`. */
  async updateFatigueStatus(id: string, status: CreativePackageFatigueStatus): Promise<void> {
    await this.patch(id, "updateFatigueStatus", { fatigue_status: status });
  }

  /**
   * AAOS LOOP UPGRADE, Sprint 8a — the real `max_auto_briefs_per_day` daily-cap count, called from
   * `SchedulerService.runNeedCreativeCheck` BEFORE every real `create()` with `source: 'auto_loop'`.
   * Counts every `creative_packages` row for this tenant with `source = 'auto_loop'` and
   * `created_at >= sinceISO` (the caller passes the real start of today, UTC) — same
   * `.gte("created_at", sinceISO)` real-count-via-list convention `JudgeResultRepository
   * .listForTenantSince` already establishes in this codebase (no `SupabaseClientLike.count`
   * capability exists to reach for instead).
   */
  async countAutoLoopSince(tenantId: string, sinceISO: string): Promise<number> {
    const { data, error } = await this.client
      .from<CreativePackageRow>(TABLE)
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("source", "auto_loop")
      .gte("created_at", sinceISO);
    if (error !== null) {
      throw new CreativePackageRepositoryError(
        `CreativePackageRepository.countAutoLoopSince failed: ${error.message}`,
      );
    }
    return (data ?? []).length;
  }

  async review(
    id: string,
    status: "APPROVED" | "REJECTED",
    reviewedAt: string,
    selectedCopyVariantId?: string,
  ): Promise<void> {
    await this.patch(id, "review", {
      status,
      reviewed_at: reviewedAt,
      ...(selectedCopyVariantId !== undefined
        ? { selected_copy_variant_id: selectedCopyVariantId }
        : {}),
    });
  }

  /**
   * AAOS LOOP UPGRADE, Sprint 8a — the real `PENDING_REVIEW -> DRAFT` write, called from
   * `PendingActionsService.approve`'s new `REVIEW_CREATIVE_BRIEF` branch when a human approves a
   * real auto-generated brief. Deliberately NOT `review(id, "APPROVED", ...)` — `APPROVED` on this
   * table's real status machine means "a human reviewed GENERATED creative output" (003's own
   * header doc); this is a DIFFERENT real decision (a human approved a PRE-generation brief so it
   * may now become a normal, sendable `DRAFT`) — reusing `APPROVED` here would conflate two
   * genuinely different real review moments.
   */
  async approveReview(id: string, reviewedAt: string): Promise<void> {
    await this.patch(id, "approveReview", { status: "DRAFT", reviewed_at: reviewedAt });
  }

  /**
   * AAOS LOOP UPGRADE, Sprint 8c — the real idempotency-marker write for Step 5's campaign-publish
   * check (`SchedulerService.runCampaignPublishCheck`), called exactly once per real asset once it
   * has been considered (published, escalated to human review, or best-effort skipped) — see
   * `048_campaign_auto_publish.sql`'s own doc for why this exists (without it, the same freshly-
   * generated asset would be re-evaluated, and potentially re-published as a second campaign, on
   * every subsequent loop tick).
   */
  async markCampaignPublishStatus(
    id: string,
    status: CreativePackageCampaignPublishStatus,
  ): Promise<void> {
    await this.patch(id, "markCampaignPublishStatus", { campaign_publish_status: status });
  }

  /**
   * Kai Creative Engine Sprint 5 (foundation) — the real write for `publishedMetaAdIds` (this
   * module's own domain doc). Called exactly once per real (non-simulated) publish attempt, from
   * `CampaignsService.createPropertyCampaign` right after `publishPropertyAds` returns its real
   * `adIds` — including an empty array (a real, distinct "attempted, all failed" state, never
   * conflated with "never attempted" — see the domain field's own doc).
   */
  async recordPublishedMetaAdIds(id: string, adIds: readonly string[]): Promise<void> {
    await this.patch(id, "recordPublishedMetaAdIds", { published_meta_ad_ids: adIds });
  }

  private async patch(
    id: string,
    method: string,
    values: Partial<CreativePackageRow>,
  ): Promise<void> {
    const { error } = await this.client
      .from<CreativePackageRow>(TABLE)
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error !== null) {
      throw new CreativePackageRepositoryError(
        `CreativePackageRepository.${method} failed: ${error.message}`,
      );
    }
  }
}
