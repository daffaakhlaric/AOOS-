import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { AbTestVariantRepository } from "../abtesting/infrastructure/ab-test-variant.repository.js";
import type { CampaignHealthService } from "../campaign-health/campaign-health.service.js";
import type { CampaignHealthResponseDto } from "../campaign-health/dto/campaign-health-response.dto.js";
import type { CreativeMemoryService } from "../creative-memory/creative-memory.service.js";
import type { AnglePerformanceResponseDto } from "../creative-memory/dto/angle-performance.dto.js";
import type { AdAccountOptionDto } from "../meta-ads/dto/ad-account-option.dto.js";
import type { CampaignHistoryPointDto } from "../meta-ads/dto/campaign-history.dto.js";
import type {
  AdAccountResponseDto,
  AdResponseDto,
  AdSetResponseDto,
  CampaignResponseDto,
} from "../meta-ads/dto/campaign-response.dto.js";
import type { MetaAdsService } from "../meta-ads/meta-ads.service.js";

import {
  CommandCenterService,
  MAX_CAMPAIGNS_ANALYZED,
  MAX_CAMPAIGNS_WITH_TREND,
} from "./command-center.service.js";

const TENANT = "propertyklik-demo";
const CORRELATION_ID = "corr-1";

function makeCampaign(overrides: Partial<CampaignResponseDto> = {}): CampaignResponseDto {
  return {
    id: `internal-${Math.random().toString(36).slice(2)}`,
    stableId: "A-1",
    metaId: "meta-cmp-1",
    name: "Campaign 1",
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    funnel: "TOFU",
    branch: "HQ",
    spend: 1_000_000,
    dailyBudget: 100_000,
    createdAt: new Date().toISOString(),
    adSets: [],
    ...overrides,
  };
}

function healthResponse(
  campaignId: string,
  decisionOverrides: Partial<CampaignHealthResponseDto["decision"]> = {},
): CampaignHealthResponseDto {
  return {
    campaignId,
    health: {
      delivery: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
      costEfficiency: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
      creative: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
      audience: { status: "UNKNOWN", confidence: 0, issues: [] },
      conversion: { status: "HEALTHY", score: 100, confidence: 1, issues: [] },
      tracking: { status: "UNKNOWN", confidence: 0, issues: [] },
      leadQuality: { status: "UNKNOWN", confidence: 0, issues: [] },
      overallStatus: "HEALTHY",
    },
    diagnosis: {
      confidence: 0.9,
      impact: "LOW",
      evidence: [],
      contributingFactors: [],
      recommendedFocus: [],
    },
    decision: {
      decision: Verdict.SCALE,
      confidence: 0.9,
      impact: "LOW",
      reason: "Root cause CPL_IMPROVEMENT terdeteksi.",
      riskOfDoingNothing:
        "Momentum performa positif berpotensi tidak dimanfaatkan secara maksimal.",
      expectedOutcome: "Scaling berpotensi memperbesar hasil positif.",
      monitoringPlan: { reviewAfterHours: 72, successConditions: [], rollbackConditions: [] },
      ...decisionOverrides,
    },
  };
}

/** One real `CampaignHistoryPointDto`-shaped `meta_insights_daily` day, for the sparkline-trend tests. */
function historyPoint(
  date: string,
  overrides: Partial<CampaignHistoryPointDto> = {},
): CampaignHistoryPointDto {
  return {
    date,
    spend: 100_000,
    impressions: 10_000,
    clicks: 120,
    frequency: 1.4,
    ctr: 0.012,
    cpl: 90_000,
    leads: 2,
    ...overrides,
  };
}

function buildFakeMetaAdsService(
  campaigns: readonly CampaignResponseDto[],
  accounts: readonly AdAccountOptionDto[] = [{ id: "act_1", name: "Account 1" }],
  /** Real `MetaAdsService.getCampaignHistory` result per real Meta campaign id — empty by default (the honest "no synced insight rows yet" state, which means no sparkline). */
  historyByCampaignId: Readonly<Record<string, readonly CampaignHistoryPointDto[]>> = {},
): MetaAdsService {
  const adAccountResponse: AdAccountResponseDto = {
    id: "act_1",
    name: "Account 1",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    syncedAt: new Date().toISOString(),
    campaigns,
  };
  return {
    getAdAccounts: vi.fn(async () => accounts),
    pullCampaigns: vi.fn(async () => adAccountResponse),
    /** Real `MetaAdsService.resolveCreativeThumbnails` shape — overridden per-test where a thumbnail matters. */
    resolveCreativeThumbnails: vi.fn(async () => new Map<string, string>()),
    /** Real `MetaAdsService.getCampaignHistory` shape — a plain `meta_insights_daily` read, zero Meta calls. */
    getCampaignHistory: vi.fn(async (_tenantId: string, campaignId: string) => ({
      campaignId,
      points: historyByCampaignId[campaignId] ?? [],
    })),
  } as unknown as MetaAdsService;
}

function buildFakeCampaignHealthService(
  responses: Record<string, CampaignHealthResponseDto>,
): CampaignHealthService {
  return {
    assess: vi.fn(async (_tenantId: string, campaignId: string) => {
      const response = responses[campaignId];
      if (response === undefined) {
        throw new Error(`no fake health response configured for ${campaignId}`);
      }
      return response;
    }),
  } as unknown as CampaignHealthService;
}

function buildFakeCreativeMemoryService(
  response: AnglePerformanceResponseDto,
  kaiLineage: ReadonlyMap<
    string,
    { readonly creativePackageId: string; readonly assetUrl?: string }
  > = new Map(),
): CreativeMemoryService {
  return {
    getAnglePerformance: vi.fn(async () => response),
    getKaiLineageByMetaAdId: vi.fn(async () => kaiLineage),
  } as unknown as CreativeMemoryService;
}

/** Real `AdResponseDto`-shaped ad under a real `AdSetResponseDto`, for the representative-creative tests. */
function makeAd(
  overrides: Partial<Omit<AdResponseDto, "metrics">> & {
    readonly metaId: string;
    readonly spend?: number;
    readonly impressions?: number;
  },
): AdResponseDto {
  const { spend = 0, impressions = 0, ...rest } = overrides;
  return {
    id: `internal-ad-${rest.metaId}`,
    stableId: `#C-${rest.metaId}`,
    name: `Ad ${rest.metaId}`,
    status: "ACTIVE",
    funnel: "TOFU",
    branch: "HQ",
    verdict: "KEEP",
    createdAt: "2026-09-01T00:00:00.000Z",
    metrics: {
      spend,
      impressions,
      reach: 0,
      frequency: 0,
      clicks: 0,
      conversations: 0,
      d2: 0,
      d3: 0,
      d5: 0,
      leadForm: 0,
      totalLead: 0,
      rphChat: null,
      rphD3: null,
      rphLead: null,
    },
    ...rest,
  };
}

function makeAdSet(ads: readonly AdResponseDto[]): AdSetResponseDto {
  return {
    id: "internal-adset-1",
    stableId: "#S-1",
    metaId: "meta-adset-1",
    name: "AdSet 1",
    status: "ACTIVE",
    branch: "HQ",
    dailyBudget: 100_000,
    spend: 0,
    ads,
  };
}

function buildFakeAbTestVariants(
  variants: readonly { readonly metaAdId?: string; readonly status: string }[],
): AbTestVariantRepository {
  return {
    listByTenant: vi.fn(async () => variants),
  } as unknown as AbTestVariantRepository;
}

describe("CommandCenterService.getAccountSummary", () => {
  it("enumerates real active campaigns via MetaAdsService and assesses each by its real metaId (not the internal Campaign.id)", async () => {
    const campaign = makeCampaign({
      id: "internal-uuid-1",
      metaId: "meta-cmp-1",
      name: "Campaign A",
    });
    const metaAdsService = buildFakeMetaAdsService([campaign]);
    const campaignHealthService = buildFakeCampaignHealthService({
      "meta-cmp-1": healthResponse("meta-cmp-1"),
    });
    const creativeMemoryService = buildFakeCreativeMemoryService({ angles: [] });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(campaignHealthService.assess).toHaveBeenCalledWith(TENANT, "meta-cmp-1");
    expect(result.campaigns).toHaveLength(1);
    expect(result.campaigns[0]?.campaignId).toBe("meta-cmp-1");
    expect(result.campaigns[0]?.campaignName).toBe("Campaign A");
    expect(result.campaignsAnalyzed).toBe(1);
    expect(result.campaignsCapped).toBe(false);
  });

  it("excludes non-ACTIVE campaigns from analysis", async () => {
    const active = makeCampaign({ metaId: "meta-active", status: "ACTIVE" });
    const paused = makeCampaign({ metaId: "meta-paused", status: "PAUSED" });
    const metaAdsService = buildFakeMetaAdsService([active, paused]);
    const campaignHealthService = buildFakeCampaignHealthService({
      "meta-active": healthResponse("meta-active"),
    });
    const creativeMemoryService = buildFakeCreativeMemoryService({ angles: [] });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(campaignHealthService.assess).toHaveBeenCalledTimes(1);
    expect(campaignHealthService.assess).toHaveBeenCalledWith(TENANT, "meta-active");
    expect(result.campaigns.map((c) => c.campaignId)).toEqual(["meta-active"]);
  });

  it("derives a real SCALING_OPPORTUNITY from a campaign whose real decision is Verdict.SCALE at/above the confidence bar", async () => {
    const campaign = makeCampaign({ metaId: "meta-scale" });
    const metaAdsService = buildFakeMetaAdsService([campaign]);
    const campaignHealthService = buildFakeCampaignHealthService({
      "meta-scale": healthResponse("meta-scale", { decision: Verdict.SCALE, confidence: 0.9 }),
    });
    const creativeMemoryService = buildFakeCreativeMemoryService({ angles: [] });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.type).toBe("SCALING_OPPORTUNITY");
  });

  it("derives a real CREATIVE_WINNER_EXPANSION from the account-wide angle-performance result, independent of which campaigns were analyzed", async () => {
    const metaAdsService = buildFakeMetaAdsService([]);
    const campaignHealthService = buildFakeCampaignHealthService({});
    const creativeMemoryService = buildFakeCreativeMemoryService({
      angles: [
        {
          angle: "family-friendly",
          packageCount: 3,
          aggregated: {
            spend: 1_000_000,
            impressions: 25_000,
            clicks: 500,
            reach: 20_000,
            leads: 20,
            cpl: 50_000,
          },
          dataSufficiency: { level: "HIGH", score: 90, reasons: [] },
          rank: 1,
        },
      ],
    });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(result.campaigns).toHaveLength(0);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.type).toBe("CREATIVE_WINNER_EXPANSION");
    expect(result.opportunities[0]?.description).toContain("family-friendly");
  });

  it("caps analysis at MAX_CAMPAIGNS_ANALYZED and reports campaignsCapped honestly", async () => {
    const campaigns = Array.from({ length: MAX_CAMPAIGNS_ANALYZED + 5 }, (_, i) =>
      makeCampaign({ metaId: `meta-${String(i)}` }),
    );
    const metaAdsService = buildFakeMetaAdsService(campaigns);
    const responses: Record<string, CampaignHealthResponseDto> = {};
    for (const campaign of campaigns) {
      responses[campaign.metaId] = healthResponse(campaign.metaId);
    }
    const campaignHealthService = buildFakeCampaignHealthService(responses);
    const creativeMemoryService = buildFakeCreativeMemoryService({ angles: [] });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(result.campaignsAnalyzed).toBe(MAX_CAMPAIGNS_ANALYZED);
    expect(result.campaignsCapped).toBe(true);
    expect(campaignHealthService.assess).toHaveBeenCalledTimes(MAX_CAMPAIGNS_ANALYZED);
  });

  it("records an honest per-campaign error and excludes that campaign, without failing the other real campaigns", async () => {
    const good = makeCampaign({ metaId: "meta-good" });
    const bad = makeCampaign({ metaId: "meta-bad" });
    const metaAdsService = buildFakeMetaAdsService([good, bad]);
    const campaignHealthService = buildFakeCampaignHealthService({
      "meta-good": healthResponse("meta-good"),
    });
    const creativeMemoryService = buildFakeCreativeMemoryService({ angles: [] });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(result.campaigns.map((c) => c.campaignId)).toEqual(["meta-good"]);
    expect(result.errors["campaignHealth:meta-bad"]).toBeDefined();
  });

  it("degrades honestly when campaign enumeration itself fails: campaigns is empty, errors.campaigns is set, creative-memory opportunities still real", async () => {
    const metaAdsService = {
      getAdAccounts: vi.fn(async () => {
        throw new Error("Meta token expired");
      }),
      pullCampaigns: vi.fn(),
    } as unknown as MetaAdsService;
    const campaignHealthService = buildFakeCampaignHealthService({});
    const creativeMemoryService = buildFakeCreativeMemoryService({
      angles: [
        {
          angle: "investment",
          packageCount: 2,
          aggregated: {
            spend: 500_000,
            impressions: 10_000,
            clicks: 200,
            reach: 8_000,
            leads: 5,
            cpl: 100_000,
          },
          dataSufficiency: { level: "HIGH", score: 80, reasons: [] },
          rank: 1,
        },
      ],
    });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(result.campaigns).toEqual([]);
    expect(result.errors["campaigns"]).toBe("Meta token expired");
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.type).toBe("CREATIVE_WINNER_EXPANSION");
  });

  /**
   * REAL BUG FIX regression guard (observed live 2026-09-21): this endpoint's per-request
   * `getAdAccounts` + `pullCampaigns` tree pull exhausted the real Meta connector's 200-calls/hour
   * budget after a handful of Command Center refreshes, after which enumeration failed and the whole
   * page honestly reported zero campaigns. A short TTL cache collapses a refresh storm into one pull.
   */
  it("serves a repeated call from cache without re-pulling Meta (real rate-limit budget protection)", async () => {
    const campaign = makeCampaign({ metaId: "meta-cmp-1" });
    const metaAdsService = buildFakeMetaAdsService([campaign]);
    const campaignHealthService = buildFakeCampaignHealthService({
      "meta-cmp-1": healthResponse("meta-cmp-1"),
    });
    const creativeMemoryService = buildFakeCreativeMemoryService({ angles: [] });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const first = await service.getAccountSummary(TENANT, CORRELATION_ID);
    const second = await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(second).toEqual(first);
    expect(metaAdsService.pullCampaigns).toHaveBeenCalledTimes(1);
    expect(metaAdsService.getAdAccounts).toHaveBeenCalledTimes(1);
    expect(campaignHealthService.assess).toHaveBeenCalledTimes(1);
  });

  it("never caches a FAILED enumeration — a rate-limited moment must not pin an empty summary for the whole TTL", async () => {
    let attempt = 0;
    const campaign = makeCampaign({ metaId: "meta-cmp-1" });
    const adAccountResponse: AdAccountResponseDto = {
      id: "act_1",
      name: "Account 1",
      businessManagerId: "bm_1",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      syncedAt: new Date().toISOString(),
      campaigns: [campaign],
    };
    const metaAdsService = {
      getAdAccounts: vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error("Local rate-limit budget exhausted (200 calls/hour)");
        }
        return [{ id: "act_1", name: "Account 1" }];
      }),
      pullCampaigns: vi.fn(async () => adAccountResponse),
    } as unknown as MetaAdsService;
    const campaignHealthService = buildFakeCampaignHealthService({
      "meta-cmp-1": healthResponse("meta-cmp-1"),
    });
    const creativeMemoryService = buildFakeCreativeMemoryService({ angles: [] });
    const service = new CommandCenterService(
      metaAdsService,
      campaignHealthService,
      creativeMemoryService,
    );

    const failed = await service.getAccountSummary(TENANT, CORRELATION_ID);
    expect(failed.campaigns).toEqual([]);
    expect(failed.errors["campaigns"]).toContain("rate-limit budget exhausted");

    // The retry must actually re-pull (i.e. the failure was NOT cached) and now return real data.
    const recovered = await service.getAccountSummary(TENANT, CORRELATION_ID);
    expect(recovered.campaigns).toHaveLength(1);
    expect(recovered.errors["campaigns"]).toBeUndefined();
  });
});

/**
 * AAOS Command Center creative thumbnails — the real representative-creative wiring. Every
 * assertion here is over real, already-pulled fields (`Ad.creativeAsset`/`status`/`verdict`/
 * `metrics`) plus the two real DB links (`ab_test_variants.status`,
 * `creative_packages.published_meta_ad_ids`).
 */
describe("CommandCenterService.getAccountSummary — representative creative", () => {
  const REAL_IMAGE_HASH = "4b899eb644b9f4649abeea3fe701715c";
  const REAL_VIDEO_ID = "1523323098869727";

  function buildService(
    campaign: CampaignResponseDto,
    options: {
      readonly thumbnails?: ReadonlyMap<string, string>;
      readonly kaiLineage?: ReadonlyMap<
        string,
        { readonly creativePackageId: string; readonly assetUrl?: string }
      >;
      readonly abTestVariants?: readonly { readonly metaAdId?: string; readonly status: string }[];
    } = {},
  ): { readonly service: CommandCenterService; readonly metaAdsService: MetaAdsService } {
    const metaAdsService = buildFakeMetaAdsService([campaign]);
    if (options.thumbnails !== undefined) {
      (
        metaAdsService as unknown as { resolveCreativeThumbnails: unknown }
      ).resolveCreativeThumbnails = vi.fn(async () => options.thumbnails);
    }
    const service = new CommandCenterService(
      metaAdsService,
      buildFakeCampaignHealthService({ [campaign.metaId]: healthResponse(campaign.metaId) }),
      buildFakeCreativeMemoryService({ angles: [] }, options.kaiLineage),
      buildFakeAbTestVariants(options.abTestVariants ?? []),
    );
    return { service, metaAdsService };
  }

  it("attaches the real resolved Meta IMAGE thumbnail for the highest-spending active creative", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-low",
            spend: 10,
            creativeAsset: { kind: "IMAGE", ref: "other-hash" },
          }),
          makeAd({
            metaId: "ad-high",
            spend: 900_000,
            creativeAsset: { kind: "IMAGE", ref: REAL_IMAGE_HASH },
          }),
        ]),
      ],
    });
    const { service, metaAdsService } = buildService(campaign, {
      thumbnails: new Map([[REAL_IMAGE_HASH, "https://scontent.xx.fbcdn.net/v/real.jpg"]]),
    });

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
    const creative = result.campaigns[0]?.representativeCreative;

    expect(creative?.metaAdId).toBe("ad-high");
    expect(creative?.kind).toBe("IMAGE");
    expect(creative?.metaCreativeRef).toBe(REAL_IMAGE_HASH);
    expect(creative?.thumbnailUrl).toBe("https://scontent.xx.fbcdn.net/v/real.jpg");
    expect(creative?.priorityTier).toBe(2);
    // Resolution is batched: ONE call carrying every selected ref, never one per ad/row.
    expect(metaAdsService.resolveCreativeThumbnails).toHaveBeenCalledTimes(1);
    expect(metaAdsService.resolveCreativeThumbnails).toHaveBeenCalledWith(TENANT, [
      { kind: "IMAGE", ref: REAL_IMAGE_HASH },
    ]);
  });

  it("badges the creative WINNER from a real ab_test_variants WINNER row for that exact Meta ad id", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-rich",
            spend: 900_000,
            creativeAsset: { kind: "IMAGE", ref: "rich-hash" },
          }),
          makeAd({
            metaId: "ad-winner",
            spend: 5,
            creativeAsset: { kind: "IMAGE", ref: REAL_IMAGE_HASH },
          }),
        ]),
      ],
    });
    const { service } = buildService(campaign, {
      abTestVariants: [{ metaAdId: "ad-winner", status: "WINNER" }],
      thumbnails: new Map([[REAL_IMAGE_HASH, "https://cdn.example/winner.jpg"]]),
    });

    const creative = (await service.getAccountSummary(TENANT, CORRELATION_ID)).campaigns[0]
      ?.representativeCreative;
    expect(creative?.metaAdId).toBe("ad-winner");
    expect(creative?.badge).toBe("WINNER");
    expect(creative?.priorityTier).toBe(1);
  });

  it("badges FATIGUED from Samantha's real REFRESH verdict on the selected creative", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-tired",
            spend: 500_000,
            verdict: "REFRESH",
            creativeAsset: { kind: "VIDEO", ref: REAL_VIDEO_ID },
          }),
        ]),
      ],
    });
    const { service } = buildService(campaign, {
      thumbnails: new Map([[REAL_VIDEO_ID, "https://cdn.example/poster.jpg"]]),
    });

    const creative = (await service.getAccountSummary(TENANT, CORRELATION_ID)).campaigns[0]
      ?.representativeCreative;
    expect(creative?.kind).toBe("VIDEO");
    expect(creative?.badge).toBe("FATIGUED");
    expect(creative?.thumbnailUrl).toBe("https://cdn.example/poster.jpg");
  });

  it("attaches real Kai lineage only when the selected Meta ad id is genuinely in published_meta_ad_ids", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-kai",
            spend: 700_000,
            creativeAsset: { kind: "IMAGE", ref: REAL_IMAGE_HASH },
          }),
        ]),
      ],
    });
    const { service } = buildService(campaign, {
      thumbnails: new Map([[REAL_IMAGE_HASH, "https://cdn.example/real.jpg"]]),
      kaiLineage: new Map([
        [
          "ad-kai",
          { creativePackageId: "pkg-42", assetUrl: "https://storage.googleapis.com/aaos/kai.jpg" },
        ],
      ]),
    });

    const creative = (await service.getAccountSummary(TENANT, CORRELATION_ID)).campaigns[0]
      ?.representativeCreative;
    expect(creative?.kaiCreativePackageId).toBe("pkg-42");
    expect(creative?.assetUrl).toBe("https://storage.googleapis.com/aaos/kai.jpg");
  });

  it("omits the Kai lineage fields entirely when no real published-ad link exists", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-not-kai",
            spend: 700_000,
            creativeAsset: { kind: "IMAGE", ref: REAL_IMAGE_HASH },
          }),
        ]),
      ],
    });
    const { service } = buildService(campaign, {
      thumbnails: new Map([[REAL_IMAGE_HASH, "https://cdn.example/real.jpg"]]),
    });

    const creative = (await service.getAccountSummary(TENANT, CORRELATION_ID)).campaigns[0]
      ?.representativeCreative;
    expect(creative).not.toHaveProperty("kaiCreativePackageId");
    expect(creative).not.toHaveProperty("assetUrl");
  });

  it("keeps the row intact, with no thumbnailUrl, when Meta genuinely resolved nothing", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-1",
            spend: 700_000,
            creativeAsset: { kind: "IMAGE", ref: REAL_IMAGE_HASH },
          }),
        ]),
      ],
    });
    const { service } = buildService(campaign, { thumbnails: new Map() });

    const entry = (await service.getAccountSummary(TENANT, CORRELATION_ID)).campaigns[0];
    expect(entry?.campaignName).toBe("Campaign 1");
    expect(entry?.representativeCreative?.metaCreativeRef).toBe(REAL_IMAGE_HASH);
    expect(entry?.representativeCreative).not.toHaveProperty("thumbnailUrl");
  });

  it("omits representativeCreative entirely when no ad carries a real Meta creative ref (falls through to the listing/placeholder)", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [makeAdSet([makeAd({ metaId: "ad-1", spend: 700_000 })])],
    });
    const { service, metaAdsService } = buildService(campaign);

    const entry = (await service.getAccountSummary(TENANT, CORRELATION_ID)).campaigns[0];
    expect(entry?.representativeCreative).toBeUndefined();
    // No selection means no Meta call is spent at all.
    expect(metaAdsService.resolveCreativeThumbnails).not.toHaveBeenCalled();
  });

  it("degrades honestly — rows survive unchanged — when the thumbnail resolution itself throws", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-1",
            spend: 700_000,
            creativeAsset: { kind: "IMAGE", ref: REAL_IMAGE_HASH },
          }),
        ]),
      ],
    });
    const metaAdsService = buildFakeMetaAdsService([campaign]);
    (
      metaAdsService as unknown as { resolveCreativeThumbnails: unknown }
    ).resolveCreativeThumbnails = vi.fn(async () => {
      throw new Error("Local rate-limit budget exhausted (200 calls/hour)");
    });
    const service = new CommandCenterService(
      metaAdsService,
      buildFakeCampaignHealthService({ "meta-cmp-1": healthResponse("meta-cmp-1") }),
      buildFakeCreativeMemoryService({ angles: [] }),
      buildFakeAbTestVariants([]),
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
    expect(result.campaigns).toHaveLength(1);
    expect(result.campaigns[0]?.representativeCreative).toBeUndefined();
    expect(result.errors["representativeCreative"]).toContain("200 calls/hour");
  });

  it("falls back to Samantha's SCALE verdict for WINNER when the ab_test_variants read fails", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-scale",
            spend: 700_000,
            verdict: "SCALE",
            creativeAsset: { kind: "IMAGE", ref: REAL_IMAGE_HASH },
          }),
        ]),
      ],
    });
    const abTestVariants = {
      listByTenant: vi.fn(async () => {
        throw new Error("ab_test_variants unavailable");
      }),
    } as unknown as AbTestVariantRepository;
    const service = new CommandCenterService(
      buildFakeMetaAdsService([campaign]),
      buildFakeCampaignHealthService({ "meta-cmp-1": healthResponse("meta-cmp-1") }),
      buildFakeCreativeMemoryService({ angles: [] }),
      abTestVariants,
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
    expect(result.campaigns[0]?.representativeCreative?.badge).toBe("WINNER");
    expect(result.errors["abTestWinners"]).toContain("ab_test_variants unavailable");
  });

  it("spends ZERO extra Meta calls on a second page load inside the 5-minute summary cache window", async () => {
    const campaign = makeCampaign({
      metaId: "meta-cmp-1",
      adSets: [
        makeAdSet([
          makeAd({
            metaId: "ad-1",
            spend: 700_000,
            creativeAsset: { kind: "IMAGE", ref: REAL_IMAGE_HASH },
          }),
        ]),
      ],
    });
    const { service, metaAdsService } = buildService(campaign, {
      thumbnails: new Map([[REAL_IMAGE_HASH, "https://cdn.example/real.jpg"]]),
    });

    await service.getAccountSummary(TENANT, CORRELATION_ID);
    await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(metaAdsService.pullCampaigns).toHaveBeenCalledTimes(1);
    expect(metaAdsService.resolveCreativeThumbnails).toHaveBeenCalledTimes(1);
  });
});

/**
 * Samantha Attention Queue row mini sparkline — the real `meta_insights_daily` series and its
 * honest-absence rules. Every assertion below is about REAL data presence/absence: there is no case
 * in which a fabricated or padded series is acceptable.
 */
describe("CommandCenterService.getAccountSummary — per-campaign trend sparkline", () => {
  function diagnosed(
    campaignId: string,
    rootCause: string,
    impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "HIGH",
  ): CampaignHealthResponseDto {
    const base = healthResponse(campaignId);
    return {
      ...base,
      diagnosis: { ...base.diagnosis, rootCause: rootCause as never, impact },
      decision: { ...base.decision, impact },
    };
  }

  it("attaches the real ctr series from meta_insights_daily when the real root cause is CTR_DROP", async () => {
    const campaign = makeCampaign({ metaId: "meta-cmp-1" });
    const metaAdsService = buildFakeMetaAdsService(
      [campaign],
      [{ id: "act_1", name: "Account 1" }],
      {
        "meta-cmp-1": [
          historyPoint("2026-09-15", { ctr: 0.0182 }),
          historyPoint("2026-09-16", { ctr: 0.0151 }),
          historyPoint("2026-09-17", { ctr: 0.0091 }),
        ],
      },
    );
    const service = new CommandCenterService(
      metaAdsService,
      buildFakeCampaignHealthService({ "meta-cmp-1": diagnosed("meta-cmp-1", "CTR_DROP") }),
      buildFakeCreativeMemoryService({ angles: [] }),
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
    expect(result.campaigns[0]?.trend).toEqual({ metric: "ctr", points: [0.0182, 0.0151, 0.0091] });
  });

  it("picks the metric from the real root cause: CPL_SPIKE -> cpl, FREQUENCY_RISE -> frequency", async () => {
    const cases = [
      { rootCause: "CPL_SPIKE", metric: "cpl", value: 120_000 },
      { rootCause: "CPL_IMPROVEMENT", metric: "cpl", value: 80_000 },
      { rootCause: "FREQUENCY_RISE", metric: "frequency", value: 2.3 },
      { rootCause: "CREATIVE_FATIGUE", metric: "frequency", value: 3.1 },
      { rootCause: "CTR_IMPROVEMENT", metric: "ctr", value: 0.02 },
    ] as const;

    for (const { rootCause, metric, value } of cases) {
      const campaign = makeCampaign({ metaId: "meta-cmp-1" });
      const metaAdsService = buildFakeMetaAdsService(
        [campaign],
        [{ id: "act_1", name: "Account 1" }],
        {
          "meta-cmp-1": [
            historyPoint("2026-09-16", { [metric]: value }),
            historyPoint("2026-09-17", { [metric]: value }),
          ],
        },
      );
      const service = new CommandCenterService(
        metaAdsService,
        buildFakeCampaignHealthService({ "meta-cmp-1": diagnosed("meta-cmp-1", rootCause) }),
        buildFakeCreativeMemoryService({ angles: [] }),
      );

      const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
      expect(result.campaigns[0]?.trend?.metric).toBe(metric);
      expect(result.campaigns[0]?.trend?.points).toEqual([value, value]);
    }
  });

  it("omits the trend entirely — never a guessed metric — for a root cause about none of the 3 real series", async () => {
    for (const rootCause of ["SPEND_WITHOUT_RESULT", "INSUFFICIENT_DATA"]) {
      const campaign = makeCampaign({ metaId: "meta-cmp-1" });
      const metaAdsService = buildFakeMetaAdsService(
        [campaign],
        [{ id: "act_1", name: "Account 1" }],
        {
          "meta-cmp-1": [historyPoint("2026-09-16"), historyPoint("2026-09-17")],
        },
      );
      const service = new CommandCenterService(
        metaAdsService,
        buildFakeCampaignHealthService({ "meta-cmp-1": diagnosed("meta-cmp-1", rootCause) }),
        buildFakeCreativeMemoryService({ angles: [] }),
      );

      const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
      expect(result.campaigns[0]?.trend).toBeUndefined();
      // And it must not even bother reading history for a row it cannot honestly chart.
      expect(metaAdsService.getCampaignHistory).not.toHaveBeenCalled();
    }
  });

  it("omits the trend when the campaign has fewer than 2 real days — never pads a flat line", async () => {
    const campaign = makeCampaign({ metaId: "meta-cmp-1" });
    const metaAdsService = buildFakeMetaAdsService(
      [campaign],
      [{ id: "act_1", name: "Account 1" }],
      {
        "meta-cmp-1": [historyPoint("2026-09-17", { ctr: 0.009 })],
      },
    );
    const service = new CommandCenterService(
      metaAdsService,
      buildFakeCampaignHealthService({ "meta-cmp-1": diagnosed("meta-cmp-1", "CTR_DROP") }),
      buildFakeCreativeMemoryService({ angles: [] }),
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
    expect(result.campaigns[0]?.trend).toBeUndefined();
  });

  it("degrades honestly when the real history read throws: no trend on that row, error recorded, other rows intact", async () => {
    const good = makeCampaign({ metaId: "meta-cmp-good", name: "Good" });
    const bad = makeCampaign({ metaId: "meta-cmp-bad", name: "Bad" });
    const metaAdsService = buildFakeMetaAdsService([good, bad]);
    (metaAdsService as unknown as { getCampaignHistory: unknown }).getCampaignHistory = vi.fn(
      async (_tenantId: string, campaignId: string) => {
        if (campaignId === "meta-cmp-bad") {
          throw new Error("meta_insights_daily unavailable");
        }
        return {
          campaignId,
          points: [
            historyPoint("2026-09-16", { ctr: 0.02 }),
            historyPoint("2026-09-17", { ctr: 0.01 }),
          ],
        };
      },
    );
    const service = new CommandCenterService(
      metaAdsService,
      buildFakeCampaignHealthService({
        "meta-cmp-good": diagnosed("meta-cmp-good", "CTR_DROP"),
        "meta-cmp-bad": diagnosed("meta-cmp-bad", "CTR_DROP"),
      }),
      buildFakeCreativeMemoryService({ angles: [] }),
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
    const byId = new Map(result.campaigns.map((entry) => [entry.campaignId, entry]));
    expect(byId.get("meta-cmp-good")?.trend?.points).toEqual([0.02, 0.01]);
    expect(byId.get("meta-cmp-bad")?.trend).toBeUndefined();
    expect(result.errors["campaignTrend:meta-cmp-bad"]).toContain(
      "meta_insights_daily unavailable",
    );
  });

  it("caps history reads at MAX_CAMPAIGNS_WITH_TREND, keeping the highest-impact rows", async () => {
    const campaigns = Array.from({ length: MAX_CAMPAIGNS_WITH_TREND + 5 }, (_unused, index) =>
      makeCampaign({ metaId: `meta-cmp-${String(index)}`, name: `Campaign ${String(index)}` }),
    );
    const history: Record<string, readonly CampaignHistoryPointDto[]> = {};
    const responses: Record<string, CampaignHealthResponseDto> = {};
    for (const [index, campaign] of campaigns.entries()) {
      history[campaign.metaId] = [
        historyPoint("2026-09-16", { ctr: 0.02 }),
        historyPoint("2026-09-17", { ctr: 0.01 }),
      ];
      // The first 3 are CRITICAL, the rest MEDIUM — the cap must keep the CRITICAL ones.
      responses[campaign.metaId] = diagnosed(
        campaign.metaId,
        "CTR_DROP",
        index < 3 ? "CRITICAL" : "MEDIUM",
      );
    }
    const metaAdsService = buildFakeMetaAdsService(
      campaigns,
      [{ id: "act_1", name: "Account 1" }],
      history,
    );
    const service = new CommandCenterService(
      metaAdsService,
      buildFakeCampaignHealthService(responses),
      buildFakeCreativeMemoryService({ angles: [] }),
    );

    const result = await service.getAccountSummary(TENANT, CORRELATION_ID);
    expect(metaAdsService.getCampaignHistory).toHaveBeenCalledTimes(MAX_CAMPAIGNS_WITH_TREND);
    expect(result.campaigns.filter((entry) => entry.trend !== undefined)).toHaveLength(
      MAX_CAMPAIGNS_WITH_TREND,
    );
    for (const critical of ["meta-cmp-0", "meta-cmp-1", "meta-cmp-2"]) {
      expect(result.campaigns.find((entry) => entry.campaignId === critical)?.trend).toBeDefined();
    }
  });

  it("re-reads no history at all on a second page load inside the 5-minute cache window", async () => {
    const campaign = makeCampaign({ metaId: "meta-cmp-1" });
    const metaAdsService = buildFakeMetaAdsService(
      [campaign],
      [{ id: "act_1", name: "Account 1" }],
      {
        "meta-cmp-1": [
          historyPoint("2026-09-16", { ctr: 0.02 }),
          historyPoint("2026-09-17", { ctr: 0.01 }),
        ],
      },
    );
    const service = new CommandCenterService(
      metaAdsService,
      buildFakeCampaignHealthService({ "meta-cmp-1": diagnosed("meta-cmp-1", "CTR_DROP") }),
      buildFakeCreativeMemoryService({ angles: [] }),
    );

    await service.getAccountSummary(TENANT, CORRELATION_ID);
    await service.getAccountSummary(TENANT, CORRELATION_ID);

    expect(metaAdsService.getCampaignHistory).toHaveBeenCalledTimes(1);
  });
});
