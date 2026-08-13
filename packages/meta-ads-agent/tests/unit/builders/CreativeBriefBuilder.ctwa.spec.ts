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
import { unwrap } from "../../helpers/result.js";

function metricsWith(spend: number, d3: number): AdMetrics {
  return unwrap(
    AdMetrics.create({
      spend: unwrap(Spend.create(spend)),
      impressions: 1000,
      reach: 500,
      clicks: 20,
      conversations: 30,
      d2: 0,
      d3,
      d5: 0,
      leadForm: 0,
    }),
  );
}

function makeAd(metaIdSuffix: string, name: string, branch: Branch): Ad {
  return unwrap(
    new AdBuilder()
      .withId(unwrap(AdId.create(`00000000-0000-4000-9000-${metaIdSuffix.padStart(12, "0")}`)))
      .withMetaId(`1200000${metaIdSuffix}`)
      .withName(name)
      .withBranch(branch)
      .withMetrics(metricsWith(500_000, 20))
      .withVerdict(Verdict.REFRESH)
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

const CTWA_PHONE_NUMBERS: Partial<Record<Branch, string>> = {
  [Branch.BINTARO]: "+6281100000001",
  [Branch.CINERE]: "+6281100000002",
  [Branch.UMUM]: "+6281100000003",
  [Branch.BANDUNG]: "+6281100000004",
};

/**
 * AAOS-W1D-S3, coordinator note correction #7: `CreativeBrief`'s new `callToAction`/
 * `destinationType`/`wabaPhoneNumber` fields, threaded through `CreativeBriefBuilder.generate()`.
 * Correction #6: the phone number comes from the builder's injected config map, never
 * `process.env`.
 */
describe("CreativeBriefBuilder.generate — CTWA fields (AAOS-W1D-S3)", () => {
  it("brief.callToAction is SEND_WHATSAPP_MESSAGE", () => {
    const builder = new CreativeBriefBuilder(
      () => new Date("2026-08-09T00:00:00.000Z"),
      CTWA_PHONE_NUMBERS,
    );
    const target = makeAd("020", "Xpander Cross 2019", Branch.BINTARO);
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.callToAction).toBe("SEND_WHATSAPP_MESSAGE");
  });

  it("brief.destinationType is WHATSAPP", () => {
    const builder = new CreativeBriefBuilder(
      () => new Date("2026-08-09T00:00:00.000Z"),
      CTWA_PHONE_NUMBERS,
    );
    const target = makeAd("021", "Xpander Cross 2019", Branch.BINTARO);
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.destinationType).toBe("WHATSAPP");
  });

  it("brief.wabaPhoneNumber matches the ad's branch (correct branch number, not another branch's)", () => {
    const builder = new CreativeBriefBuilder(
      () => new Date("2026-08-09T00:00:00.000Z"),
      CTWA_PHONE_NUMBERS,
    );
    const bintaro = makeAd("022", "Xpander Cross 2019", Branch.BINTARO);
    const cinere = makeAd("023", "Avanza Veloz 2020", Branch.CINERE);
    const bandung = makeAd("024", "Rush 2021", Branch.BANDUNG);

    expect(unwrap(builder.generate(bintaro, accountOf([bintaro]))).wabaPhoneNumber).toBe(
      "+6281100000001",
    );
    expect(unwrap(builder.generate(cinere, accountOf([cinere]))).wabaPhoneNumber).toBe(
      "+6281100000002",
    );
    expect(unwrap(builder.generate(bandung, accountOf([bandung]))).wabaPhoneNumber).toBe(
      "+6281100000004",
    );
  });

  it("brief.wabaPhoneNumber is undefined when the builder's config has no number for that branch (coordinator note correction #6 — never falls back to process.env)", () => {
    const builder = new CreativeBriefBuilder(() => new Date("2026-08-09T00:00:00.000Z"), {});
    const target = makeAd("025", "Xpander Cross 2019", Branch.BINTARO);
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.wabaPhoneNumber).toBeUndefined();
  });

  it("existing call sites (new CreativeBriefBuilder(now) with no phone-numbers arg) keep compiling and working — purely additive", () => {
    const builder = new CreativeBriefBuilder(() => new Date("2026-08-09T00:00:00.000Z"));
    const target = makeAd("026", "Xpander Cross 2019", Branch.BINTARO);
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok).toBe(true);
    // Still sets the CTA/destination (those don't depend on config), just no phone number.
    expect(result.ok && result.value.callToAction).toBe("SEND_WHATSAPP_MESSAGE");
    expect(result.ok && result.value.wabaPhoneNumber).toBeUndefined();
  });
});
