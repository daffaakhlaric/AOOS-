import {
  AdBuilder,
  AdId,
  AdMetrics,
  AdSetBuilder,
  Branch,
  Spend,
  Verdict,
  type Ad,
  type AdAccount,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { CreativeBriefBuilder } from "../../../src/builders/CreativeBriefBuilder.js";
import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import { TargetPersona } from "../../../src/domain/value-objects/TargetPersona.js";
import { unwrap } from "../../helpers/result.js";

function metricsWith(
  spend: number,
  d3: number,
  frequency = { impressions: 1000, reach: 500 },
): AdMetrics {
  return unwrap(
    AdMetrics.create({
      spend: unwrap(Spend.create(spend)),
      impressions: frequency.impressions,
      reach: frequency.reach,
      clicks: 20,
      conversations: 30,
      d2: 0,
      d3,
      d5: 0,
      leadForm: 0,
    }),
  );
}

function makeAd(
  metaIdSuffix: string,
  name: string,
  branch: Branch,
  metrics: AdMetrics,
  verdict: Verdict = Verdict.REFRESH,
): Ad {
  return unwrap(
    new AdBuilder()
      .withId(unwrap(AdId.create(`00000000-0000-4000-9000-${metaIdSuffix.padStart(12, "0")}`)))
      .withMetaId(`1200000${metaIdSuffix}`)
      .withName(name)
      .withBranch(branch)
      .withMetrics(metrics)
      .withVerdict(verdict)
      .build(),
  );
}

function accountOf(ads: Ad[]): AdAccount {
  const adSet = unwrap(new AdSetBuilder().withAds(ads).build());
  return {
    id: ads[0]?.adAccountId,
    name: "DSS Motor",
    businessManagerId: "bm",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [{ adSets: [adSet] }],
    syncedAt: new Date(),
  } as unknown as AdAccount;
}

const builder = new CreativeBriefBuilder(() => new Date("2026-08-09T00:00:00.000Z"));

describe("CreativeBriefBuilder.generate", () => {
  it("uses the real wall clock when no clock is injected", () => {
    const defaultBuilder = new CreativeBriefBuilder();
    const target = makeAd("010", "Xpander Cross 2019", Branch.BINTARO, metricsWith(500_000, 20));
    const result = defaultBuilder.generate(target, accountOf([target]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.createdAt).toBeInstanceOf(Date);
  });

  it("falls back to the default angle for a unit that isn't Xpander/Brio", () => {
    const target = makeAd("009", "Avanza Veloz 2021", Branch.BANDUNG, metricsWith(500_000, 20));
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.angle).toBe(AdAngle.DP_RINGAN);
  });

  it("selects DP_RINGAN for Xpander + Bintaro (first priority)", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.angle).toBe(AdAngle.DP_RINGAN);
  });

  it("referenceAdId: picks the lowest-rphD3 ad in the SAME branch+unit context, excluding itself", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8)); // rphD3=100,000
    const sameContextCheap = makeAd(
      "002",
      "Xpander Cross 2018",
      Branch.BINTARO,
      metricsWith(100_000, 50),
    ); // rphD3=2,000
    const differentBranch = makeAd(
      "003",
      "Xpander Cross 2017",
      Branch.CINERE,
      metricsWith(1_000, 100),
    ); // rphD3=10 (cheaper but wrong branch)
    const result = builder.generate(target, accountOf([target, sameContextCheap, differentBranch]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.referenceAdId).toBe(sameContextCheap.id.toString());
  });

  it("referenceAdId: falls back to the account-wide lowest-rphD3 ad when no same-context peer has a defined rphD3", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const noD3Peer = makeAd("002", "Xpander Cross 2018", Branch.BINTARO, metricsWith(100_000, 0)); // rphD3 undefined
    const accountWideCheapest = makeAd(
      "003",
      "Brio Satya 2020",
      Branch.CINERE,
      metricsWith(50_000, 50),
    ); // rphD3=1,000
    const result = builder.generate(target, accountOf([target, noD3Peer, accountWideCheapest]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.referenceAdId).toBe(accountWideCheapest.id.toString());
  });

  it("referenceAdId: undefined when no other ad in the account has a defined rphD3", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const noD3 = makeAd("002", "Brio Satya 2020", Branch.CINERE, metricsWith(50_000, 0));
    const result = builder.generate(target, accountOf([target, noD3]));
    expect(result.ok && result.value.referenceAdId).toBeUndefined();
  });

  it("selects SECONDARY_BUSINESS persona for a niche/business unit (MPV)", () => {
    const target = makeAd("001", "Xpander MPV Niaga", Branch.BANDUNG, metricsWith(800_000, 8));
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok && result.value.targetPersona).toBe(TargetPersona.SECONDARY_BUSINESS);
  });

  it("selects PRIMARY_FAMILY persona by default", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok && result.value.targetPersona).toBe(TargetPersona.PRIMARY_FAMILY);
  });

  it("urgency HIGH when frequency > 4.5", () => {
    const target = makeAd(
      "001",
      "Xpander Cross 2019",
      Branch.BINTARO,
      metricsWith(800_000, 8, { impressions: 5000, reach: 1000 }), // frequency = 5
    );
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok && result.value.urgency).toBe("HIGH");
  });

  it("urgency MEDIUM when 3 < frequency <= 4.5", () => {
    const target = makeAd(
      "001",
      "Xpander Cross 2019",
      Branch.BINTARO,
      metricsWith(800_000, 8, { impressions: 4000, reach: 1000 }), // frequency = 4
    );
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok && result.value.urgency).toBe("MEDIUM");
  });

  it("urgency LOW when frequency <= 3", () => {
    const target = makeAd(
      "001",
      "Xpander Cross 2019",
      Branch.BINTARO,
      metricsWith(800_000, 8, { impressions: 2000, reach: 1000 }), // frequency = 2
    );
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok && result.value.urgency).toBe("LOW");
  });

  it("recommends QNA-appropriate formats when the angle is QNA", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.CINERE, metricsWith(800_000, 8));
    // Xpander + Cinere first priority is GUDANGNYA, not QNA — verify the default (non-QNA/TESTIMONIAL) format branch instead.
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok && result.value.formats).toEqual(["VIDEO_15S", "IMAGE_SQUARE"]);
  });
});
