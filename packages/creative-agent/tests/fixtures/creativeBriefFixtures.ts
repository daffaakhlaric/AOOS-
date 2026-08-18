import { AdAngle, CreativeBriefId, TargetPersona, type CreativeBrief } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";

export interface FixturePriceContext {
  readonly unitPrice: number;
  readonly estimatedDp: number;
  readonly estimatedMonthly: number;
  readonly year: number;
  readonly kilometer: number;
}

export interface BuildBriefOverrides {
  readonly angle?: AdAngle;
  readonly unit?: string;
  readonly unitModel?: string;
  readonly branch?: Branch;
  readonly urgency?: "HIGH" | "MEDIUM" | "LOW";
  readonly formats?: ReadonlyArray<"VIDEO_15S" | "VIDEO_30S" | "IMAGE_SQUARE" | "IMAGE_STORY">;
  readonly priceContext?: FixturePriceContext;
  readonly activePromo?: string;
  readonly uspMessages?: ReadonlyArray<string>;
  readonly primaryMessage?: string;
  readonly tone?: string;
  readonly avoid?: ReadonlyArray<string>;
  readonly adId?: string;
  readonly referenceAdId?: string;
  readonly createdAt?: Date;
}

/**
 * `@aos/meta-ads-agent`'s public `index.ts` exports `CreativeBrief` TYPE-ONLY (`export type {
 * CreativeBrief, ... }` — its class has a private constructor and no publicly-exported factory).
 * External callers only ever RECEIVE `CreativeBrief` instances back from
 * `GenerateCreativeBrief`, never construct them directly — this mirrors `@aos/asset-library`'s
 * `Asset` (see `tests/helpers/mocks.ts`'s `buildAsset` docstring for the same pattern). Since
 * `KaiAgentService` only ever reads `CreativeBrief`'s getters (never calls back into its own
 * `.create`), a structurally-shaped fake, cast to `CreativeBrief`, is a faithful and fully
 * REAL-shaped test double — every field here matches the real `CreativeBriefProps` verified by
 * reading `packages/meta-ads-agent/src/domain/entities/CreativeBrief.ts` directly (COORDINATOR
 * NOTE corrections #1-#4 applied: plain `string` `adId`/`referenceAdId`, `reason`/
 * `estimatedImpactIfRefreshed`/`createdAt` present, `priceContext` carries `year`/`kilometer`,
 * `uspMessages` present).
 */
export function buildBrief(overrides: BuildBriefOverrides = {}): CreativeBrief {
  const fake = {
    id: CreativeBriefId.generate(),
    adId: overrides.adId ?? "ad-xpander-001",
    unit: overrides.unit ?? "Xpander Cross 2019",
    unitModel: overrides.unitModel,
    branch: overrides.branch ?? Branch.BINTARO,
    angle: overrides.angle ?? AdAngle.DP_RINGAN,
    targetPersona: TargetPersona.PRIMARY_FAMILY,
    primaryMessage: overrides.primaryMessage ?? "DP mulai 29 juta langsung bawa pulang",
    tone: overrides.tone ?? "casual, relatable, tidak formal",
    avoid: overrides.avoid ?? [],
    formats: overrides.formats ?? ["VIDEO_15S", "IMAGE_SQUARE"],
    referenceAdId: overrides.referenceAdId,
    reason: "CTR below 30-day baseline for 5 consecutive days",
    urgency: overrides.urgency ?? "HIGH",
    estimatedImpactIfRefreshed: "+15% CTR expected based on evergreen pattern match",
    createdAt: overrides.createdAt ?? new Date("2026-08-01T00:00:00.000Z"),
    priceContext: overrides.priceContext,
    activePromo: overrides.activePromo,
    uspMessages: overrides.uspMessages,
  };
  return fake as unknown as CreativeBrief;
}

export const XPANDER_PRICE_CONTEXT: FixturePriceContext = {
  unitPrice: 185_000_000,
  estimatedDp: 29_000_000,
  estimatedMonthly: 5_400_000,
  year: 2019,
  kilometer: 42_000,
};

export { AdAngle, Branch };
