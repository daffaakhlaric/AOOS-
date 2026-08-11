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
import { AgentMemory } from "../../../src/domain/entities/AgentMemory.js";
import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import { ANGLE_USP_MAP } from "../../../src/intelligence/BusinessKnowledgeBase.js";
import { buildScrapedPromo, buildScrapedUnit } from "../../fixtures/mobixFixtures.js";
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

function makeAd(metaIdSuffix: string, name: string, branch: Branch, metrics: AdMetrics): Ad {
  return unwrap(
    new AdBuilder()
      .withId(unwrap(AdId.create(`00000000-0000-4000-9000-${metaIdSuffix.padStart(12, "0")}`)))
      .withMetaId(`1200000${metaIdSuffix}`)
      .withName(name)
      .withBranch(branch)
      .withMetrics(metrics)
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

const builder = new CreativeBriefBuilder(() => new Date("2026-08-09T00:00:00.000Z"));

describe("CreativeBriefBuilder.generate — S2 price-aware messaging", () => {
  it("real unit price found: computes DP estimate + monthly estimate within +/- Rp100.000 tolerance", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedInventory(
      [
        buildScrapedUnit({
          model: "Xpander Cross AT",
          priceIDR: 195_000_000,
          branch: Branch.BINTARO,
          year: 2019,
        }),
      ],
      new Date("2026-08-09T00:00:00.000Z"),
    );

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.priceContext).toBeDefined();
    expect(result.value.priceContext?.unitPrice).toBe(195_000_000);
    expect(result.value.priceContext?.estimatedDp).toBe(29_000_000); // Math.round(195m*0.15/1m)*1m
    const monthly = result.value.priceContext?.estimatedMonthly ?? 0;
    expect(Math.abs(monthly - 5_447_333)).toBeLessThanOrEqual(100_000);
    expect(result.value.primaryMessage).toContain("Rp");
    expect(result.value.primaryMessage).toContain("Xpander Cross AT");
  });

  it("no matching unit in stock: falls back to the generic ANGLE_MESSAGES primary message", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedInventory(
      [buildScrapedUnit({ model: "Brio Satya", priceIDR: 150_000_000, branch: Branch.BINTARO })],
      new Date("2026-08-09T00:00:00.000Z"),
    );

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.priceContext).toBeUndefined();
    expect(result.value.primaryMessage.length).toBeGreaterThan(0);
  });

  it("no matching unit at THIS branch (in stock elsewhere): falls back to generic message", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedInventory(
      [
        buildScrapedUnit({
          model: "Xpander Cross AT",
          priceIDR: 195_000_000,
          branch: Branch.CINERE,
        }),
      ],
      new Date("2026-08-09T00:00:00.000Z"),
    );

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.priceContext).toBeUndefined();
  });

  it("picks the CHEAPEST matching in-stock unit when multiple exist at the branch", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedInventory(
      [
        buildScrapedUnit({
          model: "Xpander Cross AT",
          priceIDR: 220_000_000,
          branch: Branch.BINTARO,
        }),
        buildScrapedUnit({
          model: "Xpander Cross MT",
          priceIDR: 180_000_000,
          branch: Branch.BINTARO,
        }),
      ],
      new Date("2026-08-09T00:00:00.000Z"),
    );

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.priceContext?.unitPrice).toBe(180_000_000);
  });

  it("falls back to unitKeyOf (first-word heuristic) when the ad's unit isn't a TOP_UNITS model", () => {
    const target = makeAd("001", "Odyssey 2020", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedInventory(
      [buildScrapedUnit({ model: "Odyssey", priceIDR: 300_000_000, branch: Branch.BINTARO })],
      new Date("2026-08-09T00:00:00.000Z"),
    );

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.priceContext?.unitPrice).toBe(300_000_000);
  });

  it("includes an unrestricted active promo when memory has one", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedPromos([buildScrapedPromo({ title: "DP Ringan mulai 10 juta" })]);

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.activePromo).toBe("DP Ringan mulai 10 juta");
  });

  it("includes a restricted promo only when it applies to the detected unit model", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedPromos([buildScrapedPromo({ title: "Brio-only promo", appliesTo: ["Brio"] })]);

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.activePromo).toBeUndefined();
  });

  it("excludes an expired promo", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedPromos([
      buildScrapedPromo({
        title: "Expired promo",
        validUntil: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ]);

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.activePromo).toBeUndefined();
  });

  it("attaches ANGLE_USP_MAP uspMessages when memory is supplied", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();

    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.uspMessages).toEqual(ANGLE_USP_MAP[result.value.angle]);
  });

  it("uspMessages is undefined for W1D-base callers that don't supply memory", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const result = builder.generate(target, accountOf([target]));
    expect(result.ok && result.value.uspMessages).toBeUndefined();
  });

  it("uses memory-aware angle selection (AngleRecommender.selectBestAngle) when memory is supplied", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.CINERE, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    // No historical baseline seeded -> tier 2 static TOP_UNITS fallback: Xpander -> GUDANGNYA.
    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.angle).toBe(AdAngle.GUDANGNYA);
  });

  it("computes DP estimate correctly for a different price point (Rp 165.000.000 -> DP Rp 25.000.000)", () => {
    const target = makeAd("001", "Brio Satya 2020", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedInventory(
      [buildScrapedUnit({ model: "Brio Satya", priceIDR: 165_000_000, branch: Branch.BINTARO })],
      new Date("2026-08-09T00:00:00.000Z"),
    );
    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.priceContext?.estimatedDp).toBe(25_000_000);
  });

  it("monthly estimate stays within tolerance for a smaller loan amount too", () => {
    const target = makeAd("001", "Brio Satya 2020", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedInventory(
      [buildScrapedUnit({ model: "Brio Satya", priceIDR: 120_000_000, branch: Branch.BINTARO })],
      new Date("2026-08-09T00:00:00.000Z"),
    );
    const result = builder.generate(target, accountOf([target]), memory);
    // dp = round(120m*0.15/1m)*1m = 18m; loan = 102m; expected ~= 102m/48 + 102m*0.012 = 2,125,000 + 1,224,000 = 3,349,000
    const monthly = result.ok ? (result.value.priceContext?.estimatedMonthly ?? 0) : 0;
    expect(Math.abs(monthly - 3_349_000)).toBeLessThanOrEqual(100_000);
  });

  it("preserves the year and kilometer of the cheapest matched unit in the price context", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedInventory(
      [
        buildScrapedUnit({
          model: "Xpander Cross AT",
          priceIDR: 195_000_000,
          branch: Branch.BINTARO,
          year: 2021,
          km: 30_000,
        }),
      ],
      new Date("2026-08-09T00:00:00.000Z"),
    );
    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.priceContext?.year).toBe(2021);
    expect(result.ok && result.value.priceContext?.kilometer).toBe(30_000);
  });

  it("promo model matching is case-insensitive", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    memory.seedPromos([buildScrapedPromo({ title: "Xpander only promo", appliesTo: ["xpander"] })]);
    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.activePromo).toBe("Xpander only promo");
  });

  it("no priceContext when inventory is empty even though memory is supplied", () => {
    const target = makeAd("001", "Xpander Cross 2019", Branch.BINTARO, metricsWith(800_000, 8));
    const memory = new AgentMemory();
    const result = builder.generate(target, accountOf([target]), memory);
    expect(result.ok && result.value.priceContext).toBeUndefined();
  });
});
