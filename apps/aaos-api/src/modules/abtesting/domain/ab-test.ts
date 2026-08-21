/**
 * Persisted state for one A/B test (AAOS-ABTESTING-LOOKALIKE). Mirrors
 * `modules/scheduler/domain/calendar-event.ts`'s convention: a plain `Stored*` interface in
 * camelCase, mapped to/from snake_case rows inside the repository.
 *
 * DRAFT (variants' creative packages still generating) → RUNNING (every variant has a real
 * `meta_ad_id`, ads live on Meta) → COMPLETE (winner declared). A test can also end PAUSED
 * (manager-paused) or FAILED (a variant's creative generation or ad creation failed).
 */
export type AbTestStatus = "DRAFT" | "RUNNING" | "COMPLETE" | "PAUSED" | "FAILED";

/**
 * PENDING_CREATIVE (creative_packages row still GENERATING) → READY (creative COMPLETE, ad not
 * yet created) → RUNNING (ad live on Meta) → WINNER | PAUSED_LOSER (declared) → FAILED.
 */
export type AbTestVariantStatus =
  "PENDING_CREATIVE" | "READY" | "RUNNING" | "WINNER" | "PAUSED_LOSER" | "FAILED";

export interface StoredAbTestVariant {
  readonly id: string;
  readonly abTestId: string;
  readonly tenantId: string;
  readonly variantLabel: string;
  readonly angle: string;
  readonly creativePackageId: string;
  readonly metaAdId?: string;
  readonly status: AbTestVariantStatus;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly leads: number;
  readonly rphLead?: number;
  readonly ctr?: number;
  readonly lastSyncedAt?: string;
  readonly createdAt: string;
}

export interface StoredAbTest {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly campaignId: string;
  readonly adSetId: string;
  readonly pageId: string;
  /** Manager-supplied `wa.me` link — see `CreateAbTestBodySchema`'s doc for why this is asked for directly rather than resolved from `waba_configs`. Used only when a variant's creative decides `IMAGES_ONLY` (`CreateAdCreativeImageSpec.linkUrl`). */
  readonly waLink: string;
  readonly mode: "AUTO" | "MANUAL";
  readonly status: AbTestStatus;
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
}
