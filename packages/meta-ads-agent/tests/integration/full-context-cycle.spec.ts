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
  Spend,
  StableId,
  Verdict,
  type Ad,
  type AdAccount,
  type Campaign,
} from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { ExecuteVerdictPort } from "../../src/application/services/ExecutionService.js";
import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../src/config/MetaAdsAgentConfig.js";
import { AdAngle } from "../../src/domain/value-objects/AdAngle.js";
import { createSeasonalPattern } from "../../src/domain/value-objects/SeasonalPattern.js";
import { SamanthaAgentFactory } from "../../src/factories/SamanthaAgentFactory.js";
import { buildScrapedPromo, buildScrapedUnit } from "../fixtures/mobixFixtures.js";
import {
  buildObjectiveFixture,
  buildObjectiveProgressFixture,
} from "../fixtures/objectiveFixtures.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

const AD_ACCOUNT_ID = unwrap(AdAccountId.create("act_752604553578354"));
const NOW = new Date("2026-08-09T00:00:00.000Z");

function fakeExecuteVerdict(): ExecuteVerdictPort {
  return {
    execute: vi.fn().mockResolvedValue({
      ok: true,
      value: { action: "PAUSED", targetId: "x", targetType: "ad" },
    }),
  };
}

interface AdSpec {
  readonly seq: number;
  readonly name: string;
  readonly branch: Branch;
  readonly verdict: Verdict;
  readonly spendIDR: number;
  readonly conversations: number;
  readonly d3: number;
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
      .withMetaId(`12000000${String(spec.seq).padStart(8, "0")}`)
      .withAdSetId(adSetId)
      .withCampaignId(campaignId)
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName(spec.name)
      .withStatus(AdStatus.ACTIVE)
      .withFunnel(Funnel.CTWA)
      .withBranch(spec.branch)
      .withMetrics(metrics)
      .withVerdict(spec.verdict)
      .withCreatedAt(new Date("2026-06-01T00:00:00.000Z"))
      .withDaysSinceCreation(65)
      .build(),
  );
}

/**
 * A small, purpose-built `AdAccount`: one evergreen PAUSE-candidate ad (Cinere), one SCALE ad for
 * an out-of-stock unit (Stargazer/Bandung), and one REFRESH ad (Xpander/Bintaro) for the
 * price-aware creative brief — exercising every named AAOS-W1D-S1S2 scenario in one cycle.
 */
function buildFixtureAccount(): { account: AdAccount; evergreenAdId: string } {
  const campaignId = unwrap(CampaignId.create("00000000-0000-4000-8000-000000000501"));
  const adSetId = unwrap(AdSetId.create("00000000-0000-4000-8000-000000000601"));
  const campaign = unwrap(
    new CampaignBuilder()
      .withId(campaignId)
      .withStableId(unwrap(StableId.create("A", 1)))
      .withMetaId("130000000099001")
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName("Meta-CTWA-Leads-Mobix-Multi")
      .withObjective(CampaignObjective.OUTCOME_ENGAGEMENT)
      .withBranch(Branch.MULTI)
      .withFunnel(Funnel.CTWA)
      .build(),
  );

  const specs: AdSpec[] = [
    {
      seq: 1,
      name: "Xpander DP Ringan Cinere Evergreen",
      branch: Branch.CINERE,
      verdict: Verdict.PAUSE,
      spendIDR: 500_000,
      conversations: 20,
      d3: 5,
    },
    {
      seq: 2,
      name: "Stargazer",
      branch: Branch.BANDUNG,
      verdict: Verdict.SCALE,
      spendIDR: 800_000,
      conversations: 90,
      d3: 30,
    },
    {
      seq: 3,
      name: "Xpander Cross 2019",
      branch: Branch.BINTARO,
      verdict: Verdict.REFRESH,
      spendIDR: 900_000,
      conversations: 40,
      d3: 8,
      impressions: 5000,
      reach: 1000, // frequency = 5 -> HIGH urgency
    },
  ];

  const ads = specs.map((spec) => buildAd(spec, campaignId, adSetId));
  const adSet = unwrap(
    new AdSetBuilder()
      .withId(adSetId)
      .withStableId(unwrap(StableId.create("B", 1)))
      .withMetaId("140000000099001")
      .withCampaignId(campaignId)
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName("AdSet Multi")
      .withStatus(AdStatus.ACTIVE)
      .withDailyBudget(unwrap(Budget.create(1_000_000)))
      .withBranch(Branch.MULTI)
      .withSpend(unwrap(Spend.create(ads.reduce((s, a) => s + a.metrics.spend.toNumber(), 0))))
      .withAds(ads)
      .build(),
  );
  const campaigns: Campaign[] = [campaign.withAdSets([adSet])];

  const account = {
    id: AD_ACCOUNT_ID,
    name: "DSS Motor",
    businessManagerId: "bm-dss-motor",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns,
    syncedAt: NOW,
  } as unknown as AdAccount;

  return { account, evergreenAdId: ads[0]!.id.toString() };
}

function buildRuntime() {
  return SamanthaAgentFactory.create({
    config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
    publisher: createFakePublisher(),
    executeVerdict: fakeExecuteVerdict() as never,
    metaAccessToken: "test-token",
    now: () => NOW,
  });
}

describe("Full-context cycle (AAOS-W1D-S1S2 S1+S2 wired into a real RunOptimizationCycle)", () => {
  it("exercises every named scenario: evergreen protection, stock-aware auto-pause, new-unit escalation, price-aware brief, digest stock+promo section", async () => {
    const runtime = buildRuntime();
    const memory = runtime.samanthaAgentService.getMemory();
    const { account, evergreenAdId } = buildFixtureAccount();

    // S1 — mark the Cinere ad evergreen.
    memory.seedHistoricalLearnings({
      performanceBaselines: new Map(),
      evergreenAdIds: [evergreenAdId],
      fatiguePatterns: new Map(),
      seasonalPatterns: createSeasonalPattern([]),
      topAngles: [AdAngle.GUDANGNYA, AdAngle.DP_RINGAN],
    });

    // S2 — Stargazer is a known model but has 0 stock at Bandung (only Cinere); Xpander is in
    // stock at Bintaro for the price-aware creative brief.
    memory.seedInventory(
      [
        buildScrapedUnit({ model: "Stargazer", priceIDR: 250_000_000, branch: Branch.CINERE }),
        buildScrapedUnit({
          model: "Xpander Cross AT",
          priceIDR: 195_000_000,
          branch: Branch.BINTARO,
          year: 2019,
        }),
      ],
      NOW,
    );
    memory.seedPromos([buildScrapedPromo({ title: "DP Ringan mulai 10 juta" })]);
    memory.seedNewUnitsDetected([{ model: "Brio", year: 2022, branch: Branch.CINERE }]);

    const result = await runtime.runOptimizationCycle.execute({
      adAccount: account,
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { plan, creativeBriefs, escalations, digest } = result.value;

    // 1. Evergreen ad protected from auto-pause -> ESCALATE, not AUTO_EXECUTE.
    const evergreenDecision = plan.decisions.find((d) => d.targetId === evergreenAdId);
    expect(evergreenDecision).toBeDefined();
    expect(evergreenDecision?.actionKind).toBe("PAUSE");
    expect(evergreenDecision?.decisionType).toBe("ESCALATE");
    expect(evergreenDecision?.reason.toString()).toContain("Evergreen");

    // 2. Stargazer Bandung out-of-stock -> SCALE overridden to auto-pause.
    const stockDecision = plan.decisions.find((d) => d.reason.toString().includes("Stargazer"));
    expect(stockDecision).toBeDefined();
    expect(stockDecision?.actionKind).toBe("PAUSE");
    expect(stockDecision?.decisionType).toBe("AUTO_EXECUTE");
    expect(stockDecision?.reason.toString()).toContain(Branch.BANDUNG);

    // 3. New Brio unit detected -> ESCALATE suggestion decision present.
    const newUnitDecision = plan.decisions.find((d) => d.reason.toString().includes("Unit baru"));
    expect(newUnitDecision).toBeDefined();
    expect(newUnitDecision?.decisionType).toBe("ESCALATE");
    expect(newUnitDecision?.reason.toString()).toContain("Brio");
    expect(escalations.some((e) => e.decision.id.equals(newUnitDecision!.id))).toBe(true);

    // 4. CreativeBrief for Xpander Bintaro has a real price from inventory.
    expect(creativeBriefs.length).toBeGreaterThan(0);
    const xpanderBrief = creativeBriefs.find((b) => b.unit.includes("Xpander"));
    expect(xpanderBrief).toBeDefined();
    expect(xpanderBrief?.priceContext).toBeDefined();
    expect(xpanderBrief?.priceContext?.unitPrice).toBe(195_000_000);
    expect(xpanderBrief?.primaryMessage).toContain("Xpander Cross AT");

    // 5. DailyDigest includes the stock + promo section.
    expect(digest.text).toContain("📦 Status Stok");
    expect(digest.text).toContain("🎁 Promo Aktif");
    expect(digest.text).toContain("DP Ringan mulai 10 juta");
    expect(digest.text).toContain(`⚠️ Stargazer ${Branch.BANDUNG}`);
  });
});
