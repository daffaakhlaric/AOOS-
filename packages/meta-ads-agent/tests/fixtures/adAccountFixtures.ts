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
  type AdSet,
  type Campaign,
} from "@aos/meta-ads-connector";

import { unwrap } from "../helpers/result.js";

const AD_ACCOUNT_ID = unwrap(AdAccountId.create("act_752604553578354"));

export interface FixtureAdInput {
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

function buildAd(campaignId: CampaignId, adSetId: AdSetId, input: FixtureAdInput): Ad {
  const metrics = unwrap(
    AdMetrics.create({
      spend: unwrap(Spend.create(input.spendIDR)),
      impressions: input.impressions ?? 10_000,
      reach: input.reach ?? 8_000,
      clicks: 100,
      conversations: input.conversations,
      d2: 0,
      d3: input.d3,
      d5: 0,
      leadForm: 0,
    }),
  );
  return unwrap(
    new AdBuilder()
      .withId(unwrap(AdId.create(`00000000-0000-4000-9000-${String(input.seq).padStart(12, "0")}`)))
      .withStableId(unwrap(StableId.create("C", input.seq)))
      .withMetaId(`12000000${String(input.seq).padStart(8, "0")}`)
      .withAdSetId(adSetId)
      .withCampaignId(campaignId)
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName(input.name)
      .withStatus(AdStatus.ACTIVE)
      .withFunnel(Funnel.CTWA)
      .withBranch(input.branch)
      .withMetrics(metrics)
      .withVerdict(input.verdict)
      .withCreatedAt(new Date("2026-07-01T00:00:00.000Z"))
      .withDaysSinceCreation(39)
      .build(),
  );
}

/**
 * Builds a realistic ~72-ad `AdAccount` fixture spanning every `Verdict` (PAUSE/SCALE/FIX/
 * REFRESH/KEEP/REVIEW), multiple branches (CINERE/BINTARO/BANDUNG), and both DSS units (Xpander,
 * Brio) — used by integration tests exercising the full `RunOptimizationCycle`. Note: the exact
 * "avg rphChat = Rp 9.212" pinned business-correctness value from the spec's Testing Requirements
 * is tested directly against `VerdictDecisionEngine`/`DecisionEngineService` with a literal
 * `avgRphChatIDR = 9212` argument (see `tests/unit/intelligence/VerdictDecisionEngine.spec.ts`) —
 * not reverse-engineered into this fixture's own average, which is realistic but not equal to
 * that pinned figure.
 */
export function buildLargeAdAccount(): AdAccount {
  const campaignBintaro = unwrap(
    new CampaignBuilder()
      .withId(unwrap(CampaignId.create("00000000-0000-4000-8000-000000000101")))
      .withStableId(unwrap(StableId.create("A", 1)))
      .withMetaId("130000000000001")
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName("Meta-CTWA-Leads-Mobix-Bintaro")
      .withObjective(CampaignObjective.OUTCOME_ENGAGEMENT)
      .withBranch(Branch.BINTARO)
      .withFunnel(Funnel.CTWA)
      .build(),
  );
  const campaignCinere = unwrap(
    new CampaignBuilder()
      .withId(unwrap(CampaignId.create("00000000-0000-4000-8000-000000000102")))
      .withStableId(unwrap(StableId.create("A", 2)))
      .withMetaId("130000000000002")
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName("Meta-CTWA-Leads-Mobix-Cinere")
      .withObjective(CampaignObjective.OUTCOME_ENGAGEMENT)
      .withBranch(Branch.CINERE)
      .withFunnel(Funnel.CTWA)
      .build(),
  );
  const campaignBandung = unwrap(
    new CampaignBuilder()
      .withId(unwrap(CampaignId.create("00000000-0000-4000-8000-000000000103")))
      .withStableId(unwrap(StableId.create("A", 3)))
      .withMetaId("130000000000003")
      .withAdAccountId(AD_ACCOUNT_ID)
      .withName("Meta-CTWA-Leads-Mobix-Bandung")
      .withObjective(CampaignObjective.VISIT_INSTAGRAM_PROFILE)
      .withBranch(Branch.BANDUNG)
      .withFunnel(Funnel.CTWA)
      .build(),
  );

  const adSetBintaro = unwrap(AdSetId.create("00000000-0000-4000-8000-000000000201"));
  const adSetCinere = unwrap(AdSetId.create("00000000-0000-4000-8000-000000000202"));
  const adSetBandung = unwrap(AdSetId.create("00000000-0000-4000-8000-000000000203"));

  const units = ["Xpander Cross 2019", "Brio Satya 2020"];
  const branchPlan: ReadonlyArray<{ branch: Branch; campaignId: CampaignId; adSetId: AdSetId }> = [
    { branch: Branch.BINTARO, campaignId: campaignBintaro.id, adSetId: adSetBintaro },
    { branch: Branch.CINERE, campaignId: campaignCinere.id, adSetId: adSetCinere },
    { branch: Branch.BANDUNG, campaignId: campaignBandung.id, adSetId: adSetBandung },
  ];

  const verdictCycle: ReadonlyArray<Verdict> = [
    Verdict.PAUSE,
    Verdict.SCALE,
    Verdict.KEEP,
    Verdict.REFRESH,
    Verdict.REVIEW,
    Verdict.FIX,
    Verdict.PAUSE,
    Verdict.SCALE,
  ];

  const ads: Ad[] = [];
  let seq = 1;
  const totalAdsPerBranch = 24; // 3 branches * 24 = 72
  for (const plan of branchPlan) {
    for (let i = 0; i < totalAdsPerBranch; i += 1) {
      const verdict = verdictCycle[i % verdictCycle.length] ?? Verdict.KEEP;
      const unit = units[i % units.length] ?? "Xpander Cross 2019";
      let spendIDR = 0;
      let conversations = 0;
      let d3 = 0;

      switch (verdict) {
        case Verdict.PAUSE:
          // Alternate: wasted spend with 0 conversations vs. spend with weak conversations.
          if (i % 2 === 0) {
            spendIDR = 250_000 + i * 5_000;
            conversations = 0;
            d3 = 0;
          } else {
            spendIDR = 300_000 + i * 10_000;
            conversations = 12;
            d3 = 2;
          }
          break;
        case Verdict.SCALE:
          spendIDR = 500_000 + i * 15_000;
          conversations = 90 + i;
          d3 = 30 + i;
          break;
        case Verdict.FIX:
          spendIDR = 200_000;
          conversations = 20;
          d3 = 5;
          break;
        case Verdict.REFRESH:
          spendIDR = 800_000 + i * 8_000;
          conversations = 40;
          d3 = 8;
          break;
        case Verdict.KEEP:
          spendIDR = 400_000;
          conversations = 60;
          d3 = 18;
          break;
        case Verdict.REVIEW:
        default:
          spendIDR = 350_000;
          conversations = 35;
          d3 = 10;
          break;
      }

      ads.push(
        buildAd(plan.campaignId, plan.adSetId, {
          seq,
          name: `${unit} — ${plan.branch}`,
          branch: plan.branch,
          verdict,
          spendIDR,
          conversations,
          d3,
        }),
      );
      seq += 1;
    }
  }

  const adSets: AdSet[] = branchPlan.map((plan) => {
    const adsInSet = ads.filter((ad) => ad.adSetId.equals(plan.adSetId));
    return unwrap(
      new AdSetBuilder()
        .withId(plan.adSetId)
        .withStableId(unwrap(StableId.create("B", branchPlan.indexOf(plan) + 1)))
        .withMetaId(`140000000000${branchPlan.indexOf(plan) + 1}`)
        .withCampaignId(plan.campaignId)
        .withAdAccountId(AD_ACCOUNT_ID)
        .withName(`AdSet ${plan.branch}`)
        .withStatus(AdStatus.ACTIVE)
        .withDailyBudget(unwrap(Budget.create(1_000_000)))
        .withBranch(plan.branch)
        .withSpend(
          unwrap(Spend.create(adsInSet.reduce((sum, ad) => sum + ad.metrics.spend.toNumber(), 0))),
        )
        .withAds(adsInSet)
        .build(),
    );
  });

  const campaigns: Campaign[] = [
    campaignBintaro.withAdSets([adSets[0]!]),
    campaignCinere.withAdSets([adSets[1]!]),
    campaignBandung.withAdSets([adSets[2]!]),
  ];

  // `@aos/meta-ads-connector` exports `AdAccount` only as a *type* (see that package's own
  // `adAccountFixtures.ts` for the same documented pattern) — assembled as an object literal
  // matching its public shape, asserted via `as unknown as AdAccount`.
  return {
    id: AD_ACCOUNT_ID,
    name: "DSS Motor",
    businessManagerId: "bm-dss-motor",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns,
    syncedAt: new Date("2026-08-09T00:00:00.000Z"),
  } as unknown as AdAccount;
}
