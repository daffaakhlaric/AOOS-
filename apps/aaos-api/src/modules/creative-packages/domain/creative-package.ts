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
 * `DRAFT` → saved, never sent to Kai (zero Kie AI spend) · `GENERATING` → a human pressed
 * "Kirim ke Kai" and the real pipeline is running · `PENDING` → generated, awaiting review ·
 * `APPROVED`/`REJECTED` → reviewed (terminal) · `FAILED` → the real pipeline errored.
 *
 * There is deliberately no status reachable without a human action: nothing transitions a package
 * out of `DRAFT` except an explicit `POST .../generate`.
 */
export type CreativePackageStatus =
  "DRAFT" | "GENERATING" | "PENDING" | "APPROVED" | "REJECTED" | "FAILED";

/** How the brief came to exist. Both require a human click before Kai/Kie AI ever runs. */
export type CreativePackageOrigin = "MANUAL" | "SAMANTHA";

/**
 * Which real shape this row carries (K1/K2, `docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`).
 * `AUTOMOTIVE` is the pre-existing shape (`unit`/`branch`/`AdAngle`/`targetPersona` all populated).
 * `PROPERTY` populates `listingId`/`angle` (a real `PropertyAdAngle` member) instead — `unit`,
 * `branch`, and `targetPersona` are genuinely inapplicable concepts for a listing-sourced brief and
 * stay `undefined` rather than being fabricated.
 */
export type CreativePackageVertical = "AUTOMOTIVE" | "PROPERTY";

/** `@aos/creative-agent`'s real `CreativeFormat` — a package-level decision, not a per-asset tag. */
export type CreativePackageFormat = "VIDEO_AND_IMAGES" | "IMAGES_ONLY";

/** `@aos/meta-ads-agent`'s real `CreativeUrgency`. */
export type CreativePackageUrgency = "HIGH" | "MEDIUM" | "LOW";

export interface StoredCopyVariant {
  readonly id: string;
  readonly variantLabel: "A" | "B" | "C";
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
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
