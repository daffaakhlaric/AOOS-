/**
 * Persisted state of one creative package (AAOS-CREATIVE-REVIEW). Mirrors
 * `modules/scraper/domain/scrape-job.ts`'s convention: a plain `Stored*` interface in camelCase,
 * mapped to/from snake_case rows inside the repository — nothing else in the module knows the DB
 * column names.
 *
 * This REPLACES the old process-local `CreativePackageStore` `Map`. Package state is persisted so a
 * restart or a second replica cannot silently lose a review queue (or, worse, a package that cost
 * real Kie AI credits to generate).
 */

/**
 * `PENDING_REVIEW` → AAOS LOOP UPGRADE, Sprint 8a (Prompt 19 Step 3) — a real, auto-generated
 * (`source = 'auto_loop'`) brief the guardrail chain (`scheduler/domain/creative-brief-
 * guardrail.ts`) decided needs a human decision BEFORE it can even become a normal `DRAFT` —
 * reviewed via `PendingActionsService`'s real `REVIEW_CREATIVE_BRIEF` action_type (approve moves it
 * to `DRAFT`, reject moves it to `REJECTED`, both a real human click). Never reachable for a
 * `source = 'manual'` row. · `DRAFT` → saved, never sent to Kai (zero Kie AI spend) · `GENERATING`
 * → a human pressed "Kirim ke Kai" and the real pipeline is running · `PENDING` → generated,
 * awaiting review · `APPROVED`/`REJECTED` → reviewed (terminal) · `FAILED` → the real pipeline
 * errored.
 *
 * There is deliberately no status reachable without a human action: nothing transitions a package
 * out of `DRAFT` except an explicit `POST .../generate`, and nothing transitions a package OUT of
 * `PENDING_REVIEW` except a real human Approve/Reject decision (`PendingActionsService`) — even a
 * `source = 'auto_loop'` row that skips `PENDING_REVIEW` entirely (LIVE mode + the
 * `auto_approve_creative_brief` toggle ON) lands on the SAME `DRAFT` a manual brief would, still
 * requiring that same explicit `POST .../generate` click before any real Kie AI spend happens.
 */
export type CreativePackageStatus =
  "DRAFT" | "GENERATING" | "PENDING" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "FAILED";

/** How the brief came to exist. Both require a human click before Kai/Kie AI ever runs. */
export type CreativePackageOrigin = "MANUAL" | "SAMANTHA";

/**
 * AAOS LOOP UPGRADE, Sprint 8a — `047_creative_packages_auto_loop.sql`. Orthogonal to `origin`:
 * `origin` answers "whose idea was the angle" (a human's, or a Samantha REFRESH recommendation a
 * human then accepted); `source` answers "did a human click a button to create THIS row, or did the
 * scheduler insert it unattended". `'manual'` (default — every pre-existing row, and every row
 * created through the existing manual-brief/Samantha-recommendation forms) | `'auto_loop'` (this
 * dispatch's new NEED_CREATIVE-triggered auto-insert path, `SchedulerService.runNeedCreativeCheck`).
 */
export type CreativePackageSource = "manual" | "auto_loop";

/** AAOS LOOP UPGRADE, Sprint 8a. Brief-level priority — distinct from `urgency` (a generation-level `CreativeUrgency`). Defaults to `MEDIUM`. */
export type CreativePackagePriority = "LOW" | "MEDIUM" | "HIGH";

/**
 * AAOS LOOP UPGRADE, Sprint 8c (`048_campaign_auto_publish.sql`) — real idempotency marker for
 * `SchedulerService.runCampaignPublishCheck`'s Step 5 trigger, so the SAME freshly-generated asset is
 * never re-considered on a later loop tick. `undefined` (NULL) = not yet considered.
 */
export type CreativePackageCampaignPublishStatus = "PUBLISHED" | "PENDING_REVIEW" | "SKIPPED";

/**
 * Which real shape this row carries (K1/K2, `docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`).
 * `AUTOMOTIVE` is the pre-existing shape (`unit`/`branch`/`AdAngle`/`targetPersona` all populated).
 * `PROPERTY` populates `listingId`/`angle` (a real `PropertyAdAngle` member) instead — `unit`,
 * `branch`, and `targetPersona` are genuinely inapplicable concepts for a listing-sourced brief and
 * stay `undefined` rather than being fabricated.
 */
export type CreativePackageVertical = "AUTOMOTIVE" | "PROPERTY";

/** `044_creative_packages_fatigue.sql` (AAOS LOOP UPGRADE, Sprint 6 Prompt 16). `NORMAL` (default) → `WARNING` (real, frequency-only degrade — see `scheduler/domain/fatigue.ts`'s own doc) → `FATIGUED` (requires a real, confirmed CTR-trend drop this app cannot compute yet — see that same doc). */
export type CreativePackageFatigueStatus = "NORMAL" | "WARNING" | "FATIGUED";

/** `@aos/creative-agent`'s real `CreativeFormat` — a package-level decision, not a per-asset tag. */
export type CreativePackageFormat = "VIDEO_AND_IMAGES" | "IMAGES_ONLY";

/** `@aos/meta-ads-agent`'s real `CreativeUrgency`. */
export type CreativePackageUrgency = "HIGH" | "MEDIUM" | "LOW";

export interface StoredCopyVariant {
  readonly id: string;
  /**
   * Originally a fixed `"A" | "B" | "C"` literal union (real Meta-native 3-way A/B testing
   * convention). Widened to `string` for the bulk-publish scope (user-requested: "Publish otomatis
   * creative dalam jumlah besar (8-25) langsung ke Meta") — `LlmService.generateAdCopyVariants` can
   * now honestly return up to `MAX_VARIANT_COUNT` (25) distinct letter labels (`ad-copy-variants.dto.ts`'s
   * own `VARIANT_LABELS`), and this storage type must accept whichever of those a real generation
   * run produced. Every pre-existing 3-variant row still stores exactly `"A"`/`"B"`/`"C"` — this is
   * a pure widening, not a behavior change for existing data.
   */
  readonly variantLabel: string;
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — Meta's real ad-creative `link_description` field
   * (`object_story_spec.link_data.description` for an image ad, `.video_data.link_description` for
   * a video ad — see `IMetaAdsClient.CreateAdCreativeImageSpec`/`CreateAdCreativeVideoSpec`'s own
   * doc for the exact wire shape). Additive/optional: every pre-existing `copyVariants` row (the
   * deterministic `CopyBuilder`/`PropertyCopyBuilder` templates, which have never produced this
   * field) has no `description` and stays `undefined` — never a fabricated empty string. Populated
   * only by `LlmService.generateAdCopyVariants`'s real LLM output (see that method's own doc).
   * `copy_variants` is a JSONB column (`003_creative_packages.sql`) so this is a pure additive
   * TypeScript-shape change — no migration required.
   */
  readonly description?: string;
}

export interface StoredCreativePackage {
  readonly id: string;
  readonly tenantId: string;
  readonly briefId: string;
  readonly adId?: string;
  readonly stableId?: string;
  readonly vertical: CreativePackageVertical;
  /** Real, tenant-scoped `listings.id` — set only when `vertical === "PROPERTY"`. */
  readonly listingId?: string;
  /** `AUTOMOTIVE`-only. */
  readonly branch?: string;
  /** The scraped unit's `identityKey` — the exact key `GetAssetsByUnit` matches on (`assets.unit_id`). `AUTOMOTIVE`-only. */
  readonly unit?: string;
  /** Human-readable model for display (`assets.unit_model` / `scraped_units.model`). */
  readonly unitModel?: string;
  readonly title: string;
  /** An `AdAngle` member for `AUTOMOTIVE`, a `PropertyAdAngle` member for `PROPERTY`. */
  readonly angle: string;
  /** `TargetPersona` member — a required `CreativeBrief` field, chosen by the manager. `AUTOMOTIVE`-only. */
  readonly targetPersona?: string;
  /** Why this creative is being made (manager's words, or Samantha's real REFRESH reason). */
  readonly reason: string;
  /** What the manager asked for. */
  readonly requestedFormat: CreativePackageFormat;
  /** What Kai's real `FormatDecider` actually decided — may downgrade to `IMAGES_ONLY` when a unit has no source photos. `undefined` until generation runs. */
  readonly decidedFormat?: CreativePackageFormat;
  readonly primaryMessage: string;
  readonly urgency: CreativePackageUrgency;
  readonly origin: CreativePackageOrigin;
  readonly status: CreativePackageStatus;
  /**
   * `042_creative_packages_ai_recommended.sql` — real, persisted record of whether THIS package's
   * brief was submitted with an accepted Kai angle recommendation
   * (`src/lib/kaiRecommendations.ts`'s threshold logic, `PropertyManualBriefForm.tsx`'s Step 2
   * checkbox). Only ever `true` for a `PROPERTY` package today — `AUTOMOTIVE`'s `ManualBriefForm.tsx`
   * has no recommendation logic to accept.
   */
  readonly aiRecommended: boolean;
  /** `044_creative_packages_fatigue.sql`. Defaults to `NORMAL` for every pre-existing row. */
  readonly fatigueStatus: CreativePackageFatigueStatus;
  /** `047_creative_packages_auto_loop.sql`. Defaults to `'manual'` for every pre-existing row. */
  readonly source: CreativePackageSource;
  /** `047_creative_packages_auto_loop.sql`. The real `listings.id` a `source: 'auto_loop'` brief's NEED_CREATIVE check fired for — `undefined` for every `manual` row. */
  readonly relatedVerdictId?: string;
  /** `047_creative_packages_auto_loop.sql`. Defaults to `MEDIUM` for every pre-existing row. */
  readonly priority: CreativePackagePriority;
  /** Real `@aos/asset-library` public URLs of the source photos found for `unit` when generation started. An empty array is a real state, not "unknown". */
  readonly sourcePhotoUrls: readonly string[];
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly StoredCopyVariant[];
  /** The real Kie AI model string Kai reports (e.g. `veo3_fast+nano-banana-pro`). */
  readonly aiModel?: string;
  /** Kai's real `ConfidenceScore` (0..1) for the delivered package. */
  readonly confidenceScore?: number;
  readonly generationMs?: number;
  readonly selectedCopyVariantId?: string;
  readonly errorMessage?: string;
  readonly generatedAt?: string;
  readonly reviewedAt?: string;
  /** `048_campaign_auto_publish.sql`. `undefined` = not yet considered by Step 5's real campaign-publish check. */
  readonly campaignPublishStatus?: CreativePackageCampaignPublishStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Everything a manual/Samantha-approved brief needs before it is persisted as a `DRAFT`. */
export interface CreateCreativePackageInput {
  readonly id: string;
  readonly tenantId: string;
  readonly briefId: string;
  readonly adId?: string;
  readonly stableId?: string;
  readonly vertical: CreativePackageVertical;
  readonly listingId?: string;
  readonly branch?: string;
  readonly unit?: string;
  readonly unitModel?: string;
  readonly title: string;
  readonly angle: string;
  readonly targetPersona?: string;
  readonly reason: string;
  readonly requestedFormat: CreativePackageFormat;
  readonly primaryMessage: string;
  readonly urgency: CreativePackageUrgency;
  readonly origin: CreativePackageOrigin;
  /** Defaults to `false` at the call site when the caller (e.g. `create()`, AUTOMOTIVE) has no recommendation concept at all. */
  readonly aiRecommended?: boolean;
  /** AAOS LOOP UPGRADE, Sprint 8a. Defaults to `'manual'` at the repository layer when omitted — every real caller except `SchedulerService.runNeedCreativeCheck` omits this. */
  readonly source?: CreativePackageSource;
  readonly relatedVerdictId?: string;
  /** AAOS LOOP UPGRADE, Sprint 8a. Defaults to `'MEDIUM'` at the repository layer when omitted. */
  readonly priority?: CreativePackagePriority;
  /** AAOS LOOP UPGRADE, Sprint 8a. Defaults to `'DRAFT'` at the repository layer when omitted (every pre-existing real caller's real behavior, unchanged) — `runNeedCreativeCheck` is the only real caller that ever passes `'PENDING_REVIEW'`, per the real guardrail decision (`creative-brief-guardrail.ts`). */
  readonly initialStatus?: "DRAFT" | "PENDING_REVIEW";
}

/** The real, measured outcome of one successful `ProcessCreativeBrief` run. */
export interface CreativeGenerationOutcome {
  readonly decidedFormat: CreativePackageFormat;
  readonly sourcePhotoUrls: readonly string[];
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly StoredCopyVariant[];
  readonly aiModel?: string;
  readonly confidenceScore?: number;
  readonly generationMs?: number;
}
