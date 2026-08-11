import {
  AdAccountId,
  AdBuilder,
  AdMetrics,
  AdSetBuilder,
  CampaignBuilder,
  Spend,
  Verdict,
  type Ad,
  type AdAccount,
} from "@aos/meta-ads-connector";

import { unwrap } from "../helpers/result.js";

function metricsFor(spend: number, d3: number): AdMetrics {
  return unwrap(
    AdMetrics.create({
      spend: unwrap(Spend.create(spend)),
      impressions: 1000,
      reach: 800,
      clicks: 50,
      conversations: d3 * 3,
      d2: Math.round(d3 * 0.5),
      d3,
      d5: Math.round(d3 * 0.2),
      leadForm: 0,
    }),
  );
}

/**
 * `@aos/meta-ads-connector` exports `AdAccount` only as a *type* (its class value is never
 * exported — see `packages/meta-ads-connector/src/index.ts`), and ships no `AdAccountBuilder`
 * (unlike `Campaign`/`AdSet`/`Ad`, which all have exported Builders). By design, `AdAccount` is
 * meant to be produced only via `PullCampaignData` (a real Meta API sync), not composed
 * externally — a legitimate choice on that package's part, not a bug to patch. For this
 * package's tests, which need a real `AdAccount` value without driving the full MSW-mocked HTTP
 * sync flow, this fixture builds every nested `Campaign`/`AdSet`/`Ad` via meta-ads-connector's
 * own real, exported Builders, then assembles the object literal matching `AdAccount`'s public
 * shape (this package only ever *reads* `AdAccount`'s properties — `.id`, `.campaigns`, etc. —
 * never calls its entity methods), asserted as `AdAccount` via `as unknown as AdAccount` since
 * `AdAccount`'s private constructor makes it nominally typed. See package report.
 */
export function buildAdAccountFixture(): AdAccount {
  const ads: Ad[] = [
    unwrap(
      new AdBuilder()
        .withName("Gudangnya Xpander")
        .withVerdict(Verdict.SCALE)
        .withMetrics(metricsFor(140_000, 100)) // rphD3 = 1,400 — cheap
        .build(),
    ),
    unwrap(
      new AdBuilder()
        .withMetaId("120000000000103")
        .withName("Promo Brio Akhir Bulan")
        .withVerdict(Verdict.PAUSE)
        .withMetrics(metricsFor(2_100_000, 30)) // rphD3 = 70,000 — expensive
        .build(),
    ),
    unwrap(
      new AdBuilder()
        .withMetaId("120000000000203")
        .withName("Avanza Keluarga Ceria")
        .withVerdict(Verdict.KEEP)
        .withMetrics(metricsFor(500_000, 100)) // rphD3 = 5,000
        .build(),
    ),
    unwrap(
      new AdBuilder()
        .withMetaId("120000000000303")
        .withName("Fortuner Adventure")
        .withVerdict(Verdict.FIX)
        .withMetrics(metricsFor(300_000, 50)) // rphD3 = 6,000
        .build(),
    ),
    unwrap(
      new AdBuilder()
        .withMetaId("120000000000403")
        .withName("HRV Stylish Ride")
        .withVerdict(Verdict.REFRESH)
        .withMetrics(metricsFor(400_000, 40)) // rphD3 = 10,000
        .build(),
    ),
    unwrap(
      new AdBuilder()
        .withMetaId("120000000000503")
        .withName("Mobilio Zero D3")
        .withVerdict(Verdict.REVIEW)
        .withMetrics(metricsFor(50_000, 0)) // rphD3 undefined — 0 D3s
        .build(),
    ),
  ];

  const adSet = unwrap(new AdSetBuilder().withAds(ads).build());
  const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());

  return {
    id: unwrap(AdAccountId.create("act_752604553578354")),
    name: "DSS Motor Jakarta",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [campaign],
    syncedAt: new Date("2026-08-08T00:00:00.000Z"),
  } as unknown as AdAccount;
}

/** An `AdAccount` with zero campaigns — spec edge case "adAccount with 0 campaigns". */
export function buildEmptyAdAccountFixture(): AdAccount {
  return {
    id: unwrap(AdAccountId.create("act_1")),
    name: "Empty Account",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [],
    syncedAt: new Date("2026-08-08T00:00:00.000Z"),
  } as unknown as AdAccount;
}
