import { expect, it } from "vitest";
import {
  buildCreativeGallery,
  buildSamanthaCreativeAnalysis,
  classifyCreativeHealth,
  creativeAngleOptions,
  creativeFormatDistribution,
  creativeFormatOptions,
  creativeHealthCounts,
  creativeInsights,
  filterCreativeGallery,
  sortCreativeGallery,
  topCtrPerformerInsight,
} from "@/lib/creative-health";
import type { AdSummaryDto } from "@/types/dashboard.types";
import type { CampaignPackage } from "@/lib/campaign-workspace";

function ad(overrides: Partial<AdSummaryDto> = {}): AdSummaryDto {
  return {
    id: overrides.id ?? "id",
    metaId: overrides.metaId ?? "ad1",
    stableId: overrides.stableId ?? "A1",
    name: overrides.name ?? "Ad",
    status: overrides.status ?? "ACTIVE",
    verdict: overrides.verdict ?? "REVIEW",
    metrics: overrides.metrics ?? {
      spend: 0,
      clicks: 0,
      impressions: 0,
      frequency: 0,
      totalLead: 0,
    },
    ...overrides,
  };
}

it("classifies Winner from a real experiment winnerVariantId match, before any other signal", () => {
  const a = ad({
    metaId: "ad1",
    verdict: "PAUSE",
    metrics: { spend: 100, clicks: 5, impressions: 500, frequency: 1, totalLead: 0 },
  });
  expect(classifyCreativeHealth({ ad: a, isWinner: true })).toBe("Winner");
});

it("classifies Insufficient Data from real zero impressions, not a picked threshold", () => {
  const a = ad({ metrics: { spend: 0, clicks: 0, impressions: 0, frequency: 0, totalLead: 0 } });
  expect(classifyCreativeHealth({ ad: a, isWinner: false })).toBe("Insufficient Data");
  const undefinedImpressions = ad({ metrics: { spend: 0, clicks: 0, frequency: 0, totalLead: 0 } });
  expect(classifyCreativeHealth({ ad: undefinedImpressions, isWinner: false })).toBe(
    "Insufficient Data",
  );
});

it("classifies Fatigued/Watch/Healthy from real fatigueStatus + verdict, unchanged from prior logic", () => {
  const delivered = { spend: 100, clicks: 10, impressions: 1000, frequency: 3, totalLead: 2 };
  const fatigued = ad({ verdict: "REFRESH", metrics: delivered });
  expect(
    classifyCreativeHealth({
      ad: fatigued,
      isWinner: false,
      pkg: { fatigueStatus: "FATIGUED" } as CampaignPackage,
    }),
  ).toBe("Fatigued");
  const watch = ad({ verdict: "REFRESH", metrics: delivered });
  expect(classifyCreativeHealth({ ad: watch, isWinner: false })).toBe("Watch");
  const healthy = ad({ verdict: "KEEP", metrics: delivered });
  expect(
    classifyCreativeHealth({
      ad: healthy,
      isWinner: false,
      pkg: { fatigueStatus: "NORMAL" } as CampaignPackage,
    }),
  ).toBe("Healthy");
});

it("classifies Loser only from a real FIX/PAUSE verdict with real delivery, never a new ad", () => {
  const delivered = { spend: 500, clicks: 2, impressions: 3000, frequency: 4, totalLead: 0 };
  const loser = ad({ verdict: "PAUSE", metrics: delivered });
  expect(classifyCreativeHealth({ ad: loser, isWinner: false })).toBe("Loser");
  const fix = ad({ verdict: "FIX", metrics: delivered });
  expect(classifyCreativeHealth({ ad: fix, isWinner: false })).toBe("Loser");
});

it("falls back to Unassessed for real signals that don't map to a named state", () => {
  const a = ad({
    verdict: "SCALE",
    metrics: { spend: 100, clicks: 10, impressions: 500, frequency: 1, totalLead: 1 },
  });
  expect(classifyCreativeHealth({ ad: a, isWinner: false })).toBe("Unassessed");
});

it("builds a gallery item per ad with real per-ad metrics, never a fabricated CPL for zero leads", () => {
  const a = ad({
    metaId: "ad1",
    metrics: { spend: 100, clicks: 10, impressions: 1000, frequency: 2, totalLead: 0 },
  });
  const gallery = buildCreativeGallery([a], [], [], undefined, {});
  expect(gallery).toHaveLength(1);
  const item = gallery[0]!;
  expect(item.ctr).toBeCloseTo(0.01);
  expect(item.cpl).toBeUndefined();
  expect(item.leads).toBe(0);
});

it("counts every gallery item into exactly one of the 7 real states", () => {
  const a1 = ad({
    metaId: "ad1",
    verdict: "KEEP",
    metrics: { spend: 10, clicks: 1, impressions: 100, frequency: 1, totalLead: 1 },
  });
  const a2 = ad({
    metaId: "ad2",
    metrics: { spend: 0, clicks: 0, impressions: 0, frequency: 0, totalLead: 0 },
  });
  const gallery = buildCreativeGallery([a1, a2], [], [], undefined, {});
  const counts = creativeHealthCounts(gallery);
  expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(2);
  expect(counts["Insufficient Data"]).toBe(1);
});

it("only offers format/angle filter options genuinely present in the gallery", () => {
  const a1 = ad({ metaId: "ad1" });
  const a2 = ad({ metaId: "ad2" });
  const pkg = {
    id: "p1",
    adId: "ad1",
    angle: "INVESTASI",
    imageUrls: ["x"],
  } as unknown as CampaignPackage;
  const gallery = buildCreativeGallery([a1, a2], [pkg], [], undefined, {});
  expect(creativeFormatOptions(gallery)).toEqual(["Image", "Unknown"]);
  expect(creativeAngleOptions(gallery)).toEqual(["INVESTASI"]);
});

it("sorts by real cpl ascending, pushing ads with no leads yet to the end", () => {
  const cheap = ad({
    metaId: "cheap",
    metrics: { spend: 10, clicks: 1, impressions: 100, frequency: 1, totalLead: 2 },
  });
  const pricey = ad({
    metaId: "pricey",
    metrics: { spend: 100, clicks: 1, impressions: 100, frequency: 1, totalLead: 2 },
  });
  const noLeads = ad({
    metaId: "none",
    metrics: { spend: 10, clicks: 1, impressions: 100, frequency: 1, totalLead: 0 },
  });
  const gallery = buildCreativeGallery([pricey, noLeads, cheap], [], [], undefined, {});
  const sorted = sortCreativeGallery(gallery, "cpl");
  expect(sorted.map((g) => g.ad.metaId)).toEqual(["cheap", "pricey", "none"]);
});

it("filters by search across stableId/name/angle", () => {
  const a = ad({ metaId: "ad1", stableId: "C9", name: "Listing hero" });
  const gallery = buildCreativeGallery([a], [], [], undefined, {});
  expect(filterCreativeGallery(gallery, { search: "c9" })).toHaveLength(1);
  expect(filterCreativeGallery(gallery, { search: "nomatch" })).toHaveLength(0);
});

it("reports real format distribution counts", () => {
  const a1 = ad({ metaId: "a1" });
  const a2 = ad({ metaId: "a2" });
  const pkg = { id: "p", adId: "a1", videoUrl: "v.mp4" } as CampaignPackage;
  const gallery = buildCreativeGallery([a1, a2], [pkg], [], undefined, {});
  expect(
    creativeFormatDistribution(gallery).sort((a, b) => a.format.localeCompare(b.format)),
  ).toEqual([
    { format: "Unknown", count: 1 },
    { format: "Video", count: 1 },
  ]);
});

it("omits a video-vs-image insight when either group has fewer than 2 delivered ads", () => {
  const video = ad({
    metaId: "v1",
    metrics: { spend: 10, clicks: 5, impressions: 100, frequency: 1, totalLead: 1 },
  });
  const pkg = { id: "p", adId: "v1", videoUrl: "v.mp4" } as CampaignPackage;
  const gallery = buildCreativeGallery([video], [pkg], [], undefined, {});
  expect(creativeInsights(gallery)).toEqual([]);
});

it("surfaces a real CTR insight once both formats have at least 2 delivered ads", () => {
  const videoPkg = (id: string) => ({ id, adId: id, videoUrl: "v.mp4" }) as CampaignPackage;
  const v1 = ad({
    metaId: "v1",
    metrics: { spend: 10, clicks: 8, impressions: 100, frequency: 1, totalLead: 1 },
  });
  const v2 = ad({
    metaId: "v2",
    metrics: { spend: 10, clicks: 9, impressions: 100, frequency: 1, totalLead: 1 },
  });
  const i1 = ad({
    metaId: "i1",
    metrics: { spend: 10, clicks: 1, impressions: 100, frequency: 1, totalLead: 1 },
  });
  const i2 = ad({
    metaId: "i2",
    metrics: { spend: 10, clicks: 2, impressions: 100, frequency: 1, totalLead: 1 },
  });
  const imgPkg = (id: string) =>
    ({ id: `img-${id}`, adId: id, imageUrls: ["x"] }) as unknown as CampaignPackage;
  const gallery = buildCreativeGallery(
    [v1, v2, i1, i2],
    [videoPkg("v1"), videoPkg("v2"), imgPkg("i1"), imgPkg("i2")],
    [],
    undefined,
    {},
  );
  const insights = creativeInsights(gallery);
  expect(insights.length).toBeGreaterThan(0);
  expect(insights[0]).toContain("Video outperforms Image");
});

it("reports the real top-CTR performer against the real gallery average, never a single ad alone", () => {
  const solo = ad({
    metaId: "solo",
    metrics: { spend: 10, clicks: 5, impressions: 100, frequency: 1, totalLead: 1 },
  });
  expect(
    topCtrPerformerInsight(buildCreativeGallery([solo], [], [], undefined, {})),
  ).toBeUndefined();
  const low = ad({
    stableId: "C1",
    metaId: "low",
    metrics: { spend: 10, clicks: 1, impressions: 100, frequency: 1, totalLead: 1 },
  });
  const high = ad({
    stableId: "C2",
    metaId: "high",
    metrics: { spend: 10, clicks: 9, impressions: 100, frequency: 1, totalLead: 1 },
  });
  const gallery = buildCreativeGallery([low, high], [], [], undefined, {});
  const insight = topCtrPerformerInsight(gallery);
  expect(insight).toContain("C2");
  expect(insight).toContain("CTR 9.00%");
});

it("derives Samantha's posture purely from the real state counts, never a fixed label", () => {
  const counts = creativeHealthCounts([]);
  expect(buildSamanthaCreativeAnalysis([], counts, []).posture).toBe("INSUFFICIENT DATA");
  expect(buildSamanthaCreativeAnalysis([], { ...counts, Winner: 1, Healthy: 2 }, []).posture).toBe(
    "HEALTHY",
  );
  expect(buildSamanthaCreativeAnalysis([], { ...counts, Winner: 1, Watch: 1 }, []).posture).toBe(
    "MONITOR",
  );
  expect(buildSamanthaCreativeAnalysis([], { ...counts, Winner: 1, Loser: 1 }, []).posture).toBe(
    "NEEDS ATTENTION",
  );
  expect(
    buildSamanthaCreativeAnalysis([], { ...counts, Healthy: 1, Fatigued: 2 }, []).posture,
  ).toBe("NEEDS ATTENTION");
});

it("names the real fatigued creatives in the key insights, never a fabricated percentage", () => {
  const fatiguedAd = ad({
    stableId: "C4",
    metaId: "c4",
    verdict: "REFRESH",
    metrics: { spend: 100, clicks: 10, impressions: 1000, frequency: 3, totalLead: 2 },
  });
  const gallery = buildCreativeGallery(
    [fatiguedAd],
    [{ id: "p", adId: "c4", fatigueStatus: "FATIGUED" } as CampaignPackage],
    [],
    undefined,
    {},
  );
  const counts = creativeHealthCounts(gallery);
  const analysis = buildSamanthaCreativeAnalysis(gallery, counts, []);
  const fatigueLine = analysis.keyInsights.find(
    (line) => line.includes("C4") && line.includes("fatigue"),
  );
  expect(fatigueLine).toBeDefined();
  expect(fatigueLine).not.toMatch(/\d+%/);
});
