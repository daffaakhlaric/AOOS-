import {
  AdAccountId,
  AdBuilder,
  AdId,
  AdMetrics,
  AdSetBuilder,
  AdSetId,
  AdStatus,
  Branch,
  Budget,
  CampaignBuilder,
  CampaignId,
  CampaignObjective,
  Funnel,
  MetaApiError,
  Spend,
  StableId,
  Verdict,
  type Ad,
  type AdAccount,
} from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import {
  HistoricalLearningService,
  type PullCampaignDataPort,
} from "../../../../src/application/services/HistoricalLearningService.js";
import { AdAngle } from "../../../../src/domain/value-objects/AdAngle.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

const AD_ACCOUNT_ID = unwrap(AdAccountId.create("act_752604553578354"));

function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
}

interface AdSpec {
  readonly seq: number;
  readonly name: string;
  readonly branch: Branch;
  readonly funnel: Funnel;
  readonly verdict: Verdict;
  readonly spendIDR: number;
  readonly conversations: number;
  readonly d3: number;
  readonly daysSinceCreation: number;
  readonly impressions?: number;
  readonly reach?: number;
}

function buildAd(spec: AdSpec, campaignId: CampaignId, adSetId: AdSetId): Ad {
  const metrics = unwrap(
    AdMetrics.create({
      spend: unwrap(Spend.create(spec.spendIDR)),
      impressions: spec.impressions ?? 10_000,
      reach: spec.reach ?? 8_000,
      clicks: 100,
      conversations: spec.conversations,
      d2: 0,
      d3: spec.d3,
      d5: 0,
      leadForm: 0,
    }),
  );
  return unwrap(
    new AdBuilder()
      .withId(unwrap(AdId.create(`00000000-0000-4000-9000-${String(spec.seq).padStart(12, "0")}`)))
      .withStableId(unwrap(StableId.create("C", spec.seq)))
      .withMetaId(`13000000${String(spec.seq).padStart(8, "0")}`)
      .withAdSetId(adSetId)
      .withCampaignId(campaignId)
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName(spec.name)
      .withStatus(AdStatus.ACTIVE)
      .withFunnel(spec.funnel)
      .withBranch(spec.branch)
      .withMetrics(metrics)
      .withVerdict(spec.verdict)
      .withCreatedAt(new Date("2026-06-01T00:00:00.000Z"))
      .withDaysSinceCreation(spec.daysSinceCreation)
      .build(),
  );
}

function buildPulledAccount(adSpecs: readonly AdSpec[]): AdAccount {
  const campaignId = unwrap(CampaignId.create("00000000-0000-4000-8000-000000000301"));
  const adSetId = unwrap(AdSetId.create("00000000-0000-4000-8000-000000000401"));
  const campaign = unwrap(
    new CampaignBuilder()
      .withId(campaignId)
      .withStableId(unwrap(StableId.create("A", 1)))
      .withMetaId("130000000009001")
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName("Meta-CTWA-Leads-Mobix-Cinere")
      .withObjective(CampaignObjective.OUTCOME_ENGAGEMENT)
      .withBranch(Branch.CINERE)
      .withFunnel(Funnel.CTWA)
      .build(),
  );
  const ads = adSpecs.map((spec) => buildAd(spec, campaignId, adSetId));
  const adSet = unwrap(
    new AdSetBuilder()
      .withId(adSetId)
      .withStableId(unwrap(StableId.create("B", 1)))
      .withMetaId("140000000009001")
      .withCampaignId(campaignId)
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName("AdSet Cinere")
      .withStatus(AdStatus.ACTIVE)
      .withDailyBudget(unwrap(Budget.create(1_000_000)))
      .withBranch(Branch.CINERE)
      .withSpend(unwrap(Spend.create(ads.reduce((s, a) => s + a.metrics.spend.toNumber(), 0))))
      .withAds(ads)
      .build(),
  );
  return {
    id: AD_ACCOUNT_ID,
    name: "DSS Motor",
    businessManagerId: "bm-dss-motor",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [campaign.withAdSets([adSet])],
    syncedAt: new Date("2026-08-09T00:00:00.000Z"),
  } as unknown as AdAccount;
}

function fakePullSuccess(adSpecs: readonly AdSpec[]): PullCampaignDataPort {
  return { execute: vi.fn().mockResolvedValue({ ok: true, value: buildPulledAccount(adSpecs) }) };
}

describe("HistoricalLearningService.learn", () => {
  it("always requests datePreset last_30d, regardless of the requested days argument (documented limitation)", async () => {
    const pull = fakePullSuccess([]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    await service.learn(AD_ACCOUNT_ID, "token", 90);

    expect(pull.execute).toHaveBeenCalledWith(expect.objectContaining({ datePreset: "last_30d" }));
  });

  it("returns a HistoricalPeriod with days=30 (the real pulled window), never the requested 90", async () => {
    const pull = fakePullSuccess([]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token", 90);

    expect(unwrap(result).period.days).toBe(30);
  });

  it("classifies angle DP_RINGAN from a name containing 'DP'", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    const baselines = unwrap(result).performanceBaselines;

    expect(baselines).toHaveLength(1);
    expect(baselines[0]?.angle).toBe(AdAngle.DP_RINGAN);
  });

  it("classifies angle KREDIT_SYARIAH from a name containing 'Syariah'", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Brio Kredit Syariah Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).performanceBaselines[0]?.angle).toBe(AdAngle.KREDIT_SYARIAH);
  });

  it("classifies angle GUDANGNYA from a name containing 'Gudang'", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Gudangnya Xpander Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).performanceBaselines[0]?.angle).toBe(AdAngle.GUDANGNYA);
  });

  it("falls back to DP_RINGAN when no angle keyword matches", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Generic Ad Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).performanceBaselines[0]?.angle).toBe(AdAngle.DP_RINGAN);
  });

  it("builds one PerformanceBaseline per branch x funnel x angle group with correct sampleSize", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
      },
      {
        seq: 2,
        name: "Brio DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 600_000,
        conversations: 55,
        d3: 22,
        daysSinceCreation: 12,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    const baselines = unwrap(result).performanceBaselines;

    expect(baselines).toHaveLength(1);
    expect(baselines[0]?.sampleSize).toBe(2);
    expect(baselines[0]?.branch).toBe(Branch.CINERE);
    expect(baselines[0]?.funnel).toBe(Funnel.CTWA);
  });

  it("identifies an ad as evergreen when active > 60 days AND currently non-PAUSE verdict", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 65,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).evergreenAds).toHaveLength(1);
  });

  it("does NOT mark an ad evergreen when active <= 60 days, even if healthy", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 30,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).evergreenAds).toHaveLength(0);
  });

  it("does NOT mark a PAUSE-verdict ad evergreen, even if active > 60 days", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.PAUSE,
        spendIDR: 500_000,
        conversations: 0,
        d3: 0,
        daysSinceCreation: 65,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).evergreenAds).toHaveLength(0);
  });

  it("detects a fatigue pattern for a funnel when an ad's frequency exceeds 3.5", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.PAUSE,
        spendIDR: 500_000,
        conversations: 10,
        d3: 2,
        daysSinceCreation: 40,
        impressions: 40_000,
        reach: 10_000, // frequency = 4.0 > 3.5
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    const fatigue = unwrap(result).fatiguePatterns;

    expect(fatigue.has(Funnel.CTWA)).toBe(true);
    expect(fatigue.get(Funnel.CTWA)).toBe(40);
  });

  it("does not record a fatigue pattern for a funnel when no ad exceeds the frequency threshold", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
        impressions: 8_000,
        reach: 8_000, // frequency = 1.0
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).fatiguePatterns.has(Funnel.CTWA)).toBe(false);
  });

  it("ranks topAngles ascending by avg Rp/D3 (cheapest/best first)", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 1_000_000,
        conversations: 50,
        d3: 100, // rphD3 = 10_000
        daysSinceCreation: 10,
      },
      {
        seq: 2,
        name: "Gudangnya Xpander Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 1_000_000,
        conversations: 50,
        d3: 500, // rphD3 = 2_000 — cheaper, should rank first
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).topAngles[0]).toBe(AdAngle.GUDANGNYA);
    expect(unwrap(result).topAngles[1]).toBe(AdAngle.DP_RINGAN);
  });

  it("returns HistoricalLearningError when PullCampaignData fails", async () => {
    const pull: PullCampaignDataPort = {
      execute: vi.fn().mockResolvedValue({ ok: false, error: new MetaApiError("meta api down") }),
    };
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(result.ok).toBe(false);
    expect(unwrapErr(result).message).toContain("meta api down");
  });

  it("records verdictHistory with one entry per pulled ad", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.SCALE,
        spendIDR: 500_000,
        conversations: 90,
        d3: 30,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    const history = unwrap(result).verdictHistory;
    expect(history).toHaveLength(1);
    expect(history[0]?.verdict).toBe(Verdict.SCALE);
  });

  it("returns an empty seasonalPatterns map (documented limitation — no hourly data available)", async () => {
    const pull = fakePullSuccess([]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).seasonalPatterns.size).toBe(0);
  });

  it("logs a warning when a non-30 days value is requested", async () => {
    const pull = fakePullSuccess([]);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const service = new HistoricalLearningService(pull, "dss-motor", logger as never);

    await service.learn(AD_ACCOUNT_ID, "token", 60);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("ranks topBranches ascending and worstFunnels descending by avg Rp/lead", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 1_000_000,
        conversations: 50,
        d3: 100,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());

    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).topBranches).toEqual([Branch.CINERE]);
    expect(unwrap(result).worstFunnels).toEqual([Funnel.CTWA]);
  });

  it.each([
    ["Kredit Syariah tersedia", AdAngle.KREDIT_SYARIAH],
    ["Q&A seputar mobil bekas", AdAngle.QNA],
    ["Tanya jawab dulu", AdAngle.QNA],
    ["Testimoni pelanggan puas", AdAngle.TESTIMONIAL],
    ["Discovery budget 150 juta", AdAngle.DISCOVERY],
    ["Budget X juta dapat apa", AdAngle.DISCOVERY],
    ["Cek Website lengkap", AdAngle.WEBSITE_REDIRECT],
    ["Redirect ke katalog", AdAngle.WEBSITE_REDIRECT],
    ["DP Ringan mulai 10 juta", AdAngle.DP_RINGAN],
  ])("classifies angle from ad name %s -> %s", async (name, expectedAngle) => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name,
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());
    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).performanceBaselines[0]?.angle).toBe(expectedAngle);
  });

  it("returns an empty result set (no baselines/evergreen/topAngles) when the pull yields zero ads", async () => {
    const pull = fakePullSuccess([]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());
    const result = await service.learn(AD_ACCOUNT_ID, "token");
    expect(unwrap(result).performanceBaselines).toHaveLength(0);
    expect(unwrap(result).evergreenAds).toHaveLength(0);
    expect(unwrap(result).topAngles).toHaveLength(0);
    expect(unwrap(result).verdictHistory).toHaveLength(0);
  });

  it("does not log a warning when the requested days is already 30", async () => {
    const pull = fakePullSuccess([]);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const service = new HistoricalLearningService(pull, "dss-motor", logger as never);
    await service.learn(AD_ACCOUNT_ID, "token", 30);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("computes avgRphChat/avgRphD3 as the arithmetic mean across every ad in a baseline group", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 1_000_000, // conversations 100 -> rphChat 10_000; d3 100 -> rphD3 10_000
        conversations: 100,
        d3: 100,
        daysSinceCreation: 10,
      },
      {
        seq: 2,
        name: "Xpander DP Ringan Cinere 2",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 1_000_000, // conversations 50 -> rphChat 20_000; d3 50 -> rphD3 20_000
        conversations: 50,
        d3: 50,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());
    const baseline = unwrap(await service.learn(AD_ACCOUNT_ID, "token")).performanceBaselines[0];
    expect(baseline?.avgRphChat).toBe(15_000);
    expect(baseline?.avgRphD3).toBe(15_000);
  });

  it("builds separate baselines for the same branch+angle when funnels differ", async () => {
    const pull = fakePullSuccess([
      {
        seq: 1,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
      },
      {
        seq: 2,
        name: "Xpander DP Ringan Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.BRAND_BOOST,
        verdict: Verdict.KEEP,
        spendIDR: 500_000,
        conversations: 50,
        d3: 20,
        daysSinceCreation: 10,
      },
    ]);
    const service = new HistoricalLearningService(pull, "dss-motor", fakeLogger());
    const baselines = unwrap(await service.learn(AD_ACCOUNT_ID, "token")).performanceBaselines;
    expect(baselines).toHaveLength(2);
  });
});
