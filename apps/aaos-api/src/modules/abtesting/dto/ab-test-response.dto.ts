import type { StoredAbTest, StoredAbTestVariant } from "../domain/ab-test.js";

/**
 * Real, best-effort creative media for one variant — resolved via `AbTestingService.
 * getVariantMedia`'s lookup of the variant's own real `creativePackageId` (the SAME real
 * `creative_packages` row `launchTest`'s own real Meta ad-creation already reads `videoUrl`/
 * `imageUrls` from — never a second, separate media source). `undefined` when the package was
 * deleted or genuinely has no media yet (still generating) — never a fabricated placeholder URL.
 */
export interface AbTestVariantMedia {
  readonly imageUrl?: string;
  readonly videoUrl?: string;
  readonly assetKind?: "IMAGE" | "VIDEO";
  /**
   * Real copy text — the SAME `copyVariants[0]` `launchTest`'s own real Meta ad-creation already
   * treats as "the" copy for this variant (each AB-test variant owns its own dedicated
   * `creative_packages` row, not a 3-way A/B/C split within one). `undefined` when the package has
   * no copy yet (still generating) — never a fabricated headline/body.
   */
  readonly primaryText?: string;
  readonly headline?: string;
}

export interface AbTestVariantResponseDto {
  readonly id: string;
  readonly variantLabel: string;
  readonly angle: string;
  readonly creativePackageId: string;
  readonly metaAdId?: string;
  readonly status: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly leads: number;
  readonly rphLead?: number;
  readonly ctr?: number;
  readonly lastSyncedAt?: string;
  readonly imageUrl?: string;
  readonly videoUrl?: string;
  readonly assetKind?: "IMAGE" | "VIDEO";
  readonly primaryText?: string;
  readonly headline?: string;
}

export interface AbTestResponseDto {
  readonly id: string;
  readonly name: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly status: string;
  readonly thresholdSpend: number;
  readonly thresholdDays: number;
  readonly minMarginPct: number;
  readonly autoPauseLoser: boolean;
  readonly autoScaleWinner: boolean;
  readonly winnerVariantId?: string;
  readonly winnerRphLead?: number;
  readonly improvementPct?: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failedReason?: string;
  readonly createdAt: string;
  readonly variants: readonly AbTestVariantResponseDto[];
}

export function toAbTestVariantResponseDto(
  variant: StoredAbTestVariant,
  media?: AbTestVariantMedia,
): AbTestVariantResponseDto {
  return {
    id: variant.id,
    variantLabel: variant.variantLabel,
    angle: variant.angle,
    creativePackageId: variant.creativePackageId,
    ...(variant.metaAdId !== undefined ? { metaAdId: variant.metaAdId } : {}),
    status: variant.status,
    spend: variant.spend,
    impressions: variant.impressions,
    clicks: variant.clicks,
    conversations: variant.conversations,
    leads: variant.leads,
    ...(variant.rphLead !== undefined ? { rphLead: variant.rphLead } : {}),
    ...(variant.ctr !== undefined ? { ctr: variant.ctr } : {}),
    ...(variant.lastSyncedAt !== undefined ? { lastSyncedAt: variant.lastSyncedAt } : {}),
    ...(media?.imageUrl !== undefined ? { imageUrl: media.imageUrl } : {}),
    ...(media?.videoUrl !== undefined ? { videoUrl: media.videoUrl } : {}),
    ...(media?.assetKind !== undefined ? { assetKind: media.assetKind } : {}),
    ...(media?.primaryText !== undefined ? { primaryText: media.primaryText } : {}),
    ...(media?.headline !== undefined ? { headline: media.headline } : {}),
  };
}

export function toAbTestResponseDto(
  test: StoredAbTest,
  variants: readonly StoredAbTestVariant[],
  mediaByVariantId?: ReadonlyMap<string, AbTestVariantMedia>,
): AbTestResponseDto {
  return {
    id: test.id,
    name: test.name,
    campaignId: test.campaignId,
    adSetId: test.adSetId,
    status: test.status,
    thresholdSpend: test.thresholdSpend,
    thresholdDays: test.thresholdDays,
    minMarginPct: test.minMarginPct,
    autoPauseLoser: test.autoPauseLoser,
    autoScaleWinner: test.autoScaleWinner,
    ...(test.winnerVariantId !== undefined ? { winnerVariantId: test.winnerVariantId } : {}),
    ...(test.winnerRphLead !== undefined ? { winnerRphLead: test.winnerRphLead } : {}),
    ...(test.improvementPct !== undefined ? { improvementPct: test.improvementPct } : {}),
    ...(test.startedAt !== undefined ? { startedAt: test.startedAt } : {}),
    ...(test.completedAt !== undefined ? { completedAt: test.completedAt } : {}),
    ...(test.failedReason !== undefined ? { failedReason: test.failedReason } : {}),
    createdAt: test.createdAt,
    variants: variants.map((variant) =>
      toAbTestVariantResponseDto(variant, mediaByVariantId?.get(variant.id)),
    ),
  };
}
