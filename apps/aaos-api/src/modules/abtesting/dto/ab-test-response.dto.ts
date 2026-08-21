import type { StoredAbTest, StoredAbTestVariant } from "../domain/ab-test.js";

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

export function toAbTestVariantResponseDto(variant: StoredAbTestVariant): AbTestVariantResponseDto {
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
  };
}

export function toAbTestResponseDto(
  test: StoredAbTest,
  variants: readonly StoredAbTestVariant[],
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
    variants: variants.map(toAbTestVariantResponseDto),
  };
}
