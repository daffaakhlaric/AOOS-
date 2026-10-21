import type { AdSummaryDto, RepresentativeCreativeDto } from "@/types/dashboard.types";
import type { CampaignExperiment, CampaignPackage } from "./campaign-workspace";

/**
 * Creative Health classification — pure mapper, no JSX.
 *
 * 6 named states (Winner / Healthy / Watch / Fatigued / Loser / Insufficient Data), grounded ONLY
 * in real fields already present on `ad`/`pkg`/`experiment`:
 *  - Winner: real `experiment.winnerVariantId` match (unchanged from the pre-existing logic).
 *  - Insufficient Data: real `ad.metrics.impressions` is `undefined` or `0` — Meta has genuinely
 *    delivered zero impressions for this ad. This is a real binary fact (delivered vs not), not a
 *    picked threshold like "under 500 impressions" — nothing else can be honestly assessed before
 *    any delivery exists.
 *  - Fatigued / Watch / Healthy: unchanged from the pre-existing logic — real `pkg.fatigueStatus`
 *    (see apps/aaos-api's `scheduler/domain/fatigue.ts`) plus real `ad.verdict`.
 *  - Loser: real `ad.verdict` is `FIX` or `PAUSE` — both are already-computed, real severity
 *    verdicts from this codebase's own verdict engine (see `src/lib/verdict.ts`'s
 *    `VERDICT_PRIORITY`), not something invented here. Requires real delivery (impressions > 0), so
 *    a genuinely-new ad can never be misclassified as a loser.
 *  - Unassessed: real signals exist (e.g. `SCALE`/`REVIEW` verdict with no fatigue package data)
 *    but don't cleanly map to any of the 6 named states above. Kept as an honest catch-all rather
 *    than forcing every ad into one of the 6 states.
 *
 * Deliberately NOT added: an age-based "just launched" distinction. `AdSummaryDto` (this app's own
 * hand-written client-safe DTO, see `types/dashboard.types.ts`'s own header doc) carries no
 * created/launch date field for an ad — only `CampaignPackage.createdAt` (the Kai PACKAGE's creation
 * date, not the ad's, and not every ad has a linked package). Picking an arbitrary "N days old"
 * threshold without a real per-ad date would be exactly the fabricated-threshold anti-pattern this
 * feature is required to avoid.
 */
export type CreativeHealthStatus =
  "Winner" | "Healthy" | "Watch" | "Fatigued" | "Loser" | "Insufficient Data" | "Unassessed";

/** Display order for state summary cards / filter chips. */
export const CREATIVE_HEALTH_STATES: CreativeHealthStatus[] = [
  "Winner",
  "Healthy",
  "Watch",
  "Fatigued",
  "Loser",
  "Insufficient Data",
  "Unassessed",
];

export type CreativeFormat = "Video" | "Image" | "Unknown";

export interface CreativeGalleryItem {
  readonly ad: AdSummaryDto;
  readonly pkg?: CampaignPackage;
  readonly status: CreativeHealthStatus;
  readonly image?: string;
  readonly video?: string;
  readonly format: CreativeFormat;
  readonly angle?: string;
  /** Fraction 0..1, `undefined` when impressions are 0 (nothing to divide by). */
  readonly ctr?: number;
  readonly cpl?: number;
  readonly frequency?: number;
  readonly leads: number;
  readonly spend: number;
  readonly impressions: number;
}

export function classifyCreativeHealth(input: {
  ad: AdSummaryDto;
  pkg?: CampaignPackage;
  isWinner: boolean;
}): CreativeHealthStatus {
  const { ad, pkg, isWinner } = input;
  if (isWinner) return "Winner";
  const impressions = ad.metrics.impressions ?? 0;
  if (impressions === 0) return "Insufficient Data";
  if (pkg?.fatigueStatus === "FATIGUED") return "Fatigued";
  if (pkg?.fatigueStatus === "WARNING" || ad.verdict === "REFRESH") return "Watch";
  if (pkg?.fatigueStatus === "NORMAL" && ad.verdict === "KEEP") return "Healthy";
  if (ad.verdict === "FIX" || ad.verdict === "PAUSE") return "Loser";
  return "Unassessed";
}

export function buildCreativeGallery(
  ads: readonly AdSummaryDto[],
  packages: readonly CampaignPackage[],
  tests: readonly CampaignExperiment[],
  representative: RepresentativeCreativeDto | undefined,
  thumbnails: Record<string, string>,
): CreativeGalleryItem[] {
  return ads.map((ad) => {
    const pkg = packages.find(
      (p) => p.adId === ad.metaId || p.publishedMetaAdIds?.includes(ad.metaId),
    );
    const isWinner = tests.some((t) =>
      t.variants.some((v) => v.metaAdId === ad.metaId && v.id === t.winnerVariantId),
    );
    const status = classifyCreativeHealth({ ad, pkg, isWinner });
    const rep = representative?.metaAdId === ad.metaId ? representative : undefined;
    const image =
      pkg?.imageUrls?.[0] ??
      rep?.thumbnailUrl ??
      (ad.creativeAsset ? thumbnails[ad.creativeAsset.ref] : undefined);
    const video = pkg?.videoUrl ?? (rep?.kind === "VIDEO" ? rep.assetUrl : undefined);
    const format: CreativeFormat = video ? "Video" : image ? "Image" : "Unknown";
    const impressions = ad.metrics.impressions ?? 0;
    return {
      ad,
      pkg,
      status,
      image,
      video,
      format,
      angle: pkg?.angle,
      ctr: impressions > 0 ? ad.metrics.clicks / impressions : undefined,
      cpl: ad.metrics.totalLead > 0 ? ad.metrics.spend / ad.metrics.totalLead : undefined,
      frequency: ad.metrics.frequency,
      leads: ad.metrics.totalLead,
      spend: ad.metrics.spend,
      impressions,
    };
  });
}

export function creativeHealthCounts(
  gallery: readonly CreativeGalleryItem[],
): Record<CreativeHealthStatus, number> {
  const counts = Object.fromEntries(CREATIVE_HEALTH_STATES.map((s) => [s, 0])) as Record<
    CreativeHealthStatus,
    number
  >;
  for (const item of gallery) counts[item.status] += 1;
  return counts;
}

/** Only formats genuinely present in `gallery` — never offers an option nothing in the account uses. */
export function creativeFormatOptions(gallery: readonly CreativeGalleryItem[]): CreativeFormat[] {
  return [...new Set(gallery.map((g) => g.format))].sort();
}

/** Only real `pkg.angle` values genuinely present — never a fabricated fixed taxonomy. */
export function creativeAngleOptions(gallery: readonly CreativeGalleryItem[]): string[] {
  return [...new Set(gallery.flatMap((g) => (g.angle ? [g.angle] : [])))].sort();
}

export type CreativeSortKey = "performance" | "cpl" | "ctr" | "spend";

export function sortCreativeGallery(
  gallery: readonly CreativeGalleryItem[],
  key: CreativeSortKey,
): CreativeGalleryItem[] {
  const sorted = [...gallery];
  switch (key) {
    case "cpl":
      // Undefined CPL (no leads yet) sorts last — never treated as "cheapest".
      sorted.sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity));
      break;
    case "ctr":
      sorted.sort((a, b) => (b.ctr ?? -1) - (a.ctr ?? -1));
      break;
    case "spend":
      sorted.sort((a, b) => b.spend - a.spend);
      break;
    case "performance":
    default:
      // Real leads delivered — the one outcome metric every ad in the account genuinely shares.
      sorted.sort((a, b) => b.leads - a.leads);
      break;
  }
  return sorted;
}

export function filterCreativeGallery(
  gallery: readonly CreativeGalleryItem[],
  filters: {
    search?: string;
    status?: CreativeHealthStatus | "All";
    format?: CreativeFormat | "All";
    angle?: string | "All";
  },
): CreativeGalleryItem[] {
  const search = filters.search?.trim().toLowerCase();
  return gallery.filter((item) => {
    if (filters.status && filters.status !== "All" && item.status !== filters.status) return false;
    if (filters.format && filters.format !== "All" && item.format !== filters.format) return false;
    if (filters.angle && filters.angle !== "All" && item.angle !== filters.angle) return false;
    if (search) {
      const haystack = [item.ad.stableId, item.ad.name, item.ad.headline, item.angle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/** Real per-format counts — the exact source for the "Creative Distribution" panel. */
export function creativeFormatDistribution(
  gallery: readonly CreativeGalleryItem[],
): { format: CreativeFormat; count: number }[] {
  const counts = new Map<CreativeFormat, number>();
  for (const item of gallery) counts.set(item.format, (counts.get(item.format) ?? 0) + 1);
  return [...counts.entries()].map(([format, count]) => ({ format, count }));
}

/**
 * Real, aggregated-from-real-data insights only. A comparison between two formats is only surfaced
 * when BOTH groups have at least 2 real ads with real impressions — below that, a single outlier ad
 * could swing an average and the comparison would read as confident when it is not. This sample
 * floor is a self-disclosed sufficiency gate (documented here), never presented as a backend signal.
 */
export function creativeInsights(gallery: readonly CreativeGalleryItem[]): string[] {
  const insights: string[] = [];
  const withDelivery = gallery.filter((g) => g.impressions > 0);
  const byFormat = (format: CreativeFormat) => withDelivery.filter((g) => g.format === format);
  const video = byFormat("Video");
  const image = byFormat("Image");
  if (video.length >= 2 && image.length >= 2) {
    const avgCtr = (items: CreativeGalleryItem[]) =>
      items.reduce((sum, i) => sum + (i.ctr ?? 0), 0) / items.length;
    const videoCtr = avgCtr(video);
    const imageCtr = avgCtr(image);
    if (videoCtr > 0 || imageCtr > 0) {
      const better = videoCtr > imageCtr ? "Video" : "Image";
      const worse = better === "Video" ? "Image" : "Video";
      const betterAvg = better === "Video" ? videoCtr : imageCtr;
      const worseAvg = better === "Video" ? imageCtr : videoCtr;
      const upliftPct = worseAvg > 0 ? Math.round(((betterAvg - worseAvg) / worseAvg) * 100) : 0;
      if (upliftPct !== 0) {
        insights.push(
          `${better} outperforms ${worse} by ${Math.abs(upliftPct)}% CTR (${video.length} video, ${image.length} image ads with delivery).`,
        );
      }
    }
  }
  const withCpl = withDelivery.filter((g) => g.cpl !== undefined);
  const videoCpl = withCpl.filter((g) => g.format === "Video");
  const imageCpl = withCpl.filter((g) => g.format === "Image");
  if (videoCpl.length >= 2 && imageCpl.length >= 2) {
    const avg = (items: CreativeGalleryItem[]) =>
      items.reduce((sum, i) => sum + (i.cpl ?? 0), 0) / items.length;
    const videoAvg = avg(videoCpl);
    const imageAvg = avg(imageCpl);
    const cheaper = videoAvg < imageAvg ? "Video" : "Image";
    const pricier = cheaper === "Video" ? "Image" : "Video";
    const cheaperAvg = cheaper === "Video" ? videoAvg : imageAvg;
    const pricierAvg = cheaper === "Video" ? imageAvg : videoAvg;
    if (pricierAvg > 0 && cheaperAvg !== pricierAvg) {
      const pct = Math.round(((pricierAvg - cheaperAvg) / pricierAvg) * 100);
      insights.push(`${cheaper} has ${pct}% lower CPL than ${pricier} on average.`);
    }
  }
  return insights;
}

/**
 * Real top-performer-vs-average CTR callout, e.g. "C01 CTR 2.80% (45% above the campaign average)".
 * Both numbers are real: the top ad's own real CTR, and the mean of every real delivered ad's CTR in
 * this gallery. Requires at least 2 delivered ads (a single ad can't be "above average" of itself).
 */
export function topCtrPerformerInsight(
  gallery: readonly CreativeGalleryItem[],
): string | undefined {
  const withCtr = gallery.filter(
    (g): g is CreativeGalleryItem & { ctr: number } => g.ctr !== undefined,
  );
  if (withCtr.length < 2) return undefined;
  const avg = withCtr.reduce((sum, g) => sum + g.ctr, 0) / withCtr.length;
  const top = withCtr.reduce((best, g) => (g.ctr > best.ctr ? g : best));
  if (avg <= 0 || top.ctr <= avg) return undefined;
  const upliftPct = Math.round(((top.ctr - avg) / avg) * 100);
  if (upliftPct === 0) return undefined;
  return `${top.ad.stableId} CTR ${(top.ctr * 100).toFixed(2)}% (${upliftPct}% di atas rata-rata campaign).`;
}

export type CreativePosture = "HEALTHY" | "MONITOR" | "NEEDS ATTENTION" | "INSUFFICIENT DATA";

export interface SamanthaCreativeAnalysis {
  readonly posture: CreativePosture;
  readonly summary: string;
  readonly recommendation: string;
  readonly keyInsights: string[];
}

/**
 * Everything here is a real function of `gallery`/`counts`/`formatInsights` — no narrative
 * confidence is invented. `posture` is derived purely from the real state counts (never a fixed
 * "HEALTHY" string): NEEDS ATTENTION when losers exist or fatigued outnumbers winner+healthy,
 * MONITOR when anything needs watching, HEALTHY when the pool skews winner/healthy, otherwise
 * INSUFFICIENT DATA (nothing real to judge yet).
 */
export function buildSamanthaCreativeAnalysis(
  gallery: readonly CreativeGalleryItem[],
  counts: Record<CreativeHealthStatus, number>,
  formatInsights: readonly string[],
): SamanthaCreativeAnalysis {
  const judged = counts.Winner + counts.Healthy + counts.Watch + counts.Fatigued + counts.Loser;
  const posture: CreativePosture =
    judged === 0
      ? "INSUFFICIENT DATA"
      : counts.Loser > 0 || counts.Fatigued > counts.Winner + counts.Healthy
        ? "NEEDS ATTENTION"
        : counts.Watch > 0 || counts.Fatigued > 0
          ? "MONITOR"
          : counts.Winner + counts.Healthy > 0
            ? "HEALTHY"
            : "INSUFFICIENT DATA";
  const summaryParts: string[] = [];
  if (counts.Winner > 0) summaryParts.push(`${counts.Winner} clear winner`);
  if (counts.Healthy > 0) summaryParts.push(`${counts.Healthy} perform well`);
  if (counts.Watch > 0) summaryParts.push(`${counts.Watch} mulai perlu dipantau`);
  if (counts.Fatigued > 0) summaryParts.push(`${counts.Fatigued} mulai fatigue`);
  if (counts.Loser > 0) summaryParts.push(`${counts.Loser} underperforming`);
  const summary =
    summaryParts.length > 0
      ? `${summaryParts.join(", ")}.`
      : judged === 0
        ? "Belum ada creative dengan delivery yang cukup untuk dinilai."
        : "Belum ada creative yang menonjol pada periode ini.";
  const recParts: string[] = [];
  if (counts.Fatigued > 0) recParts.push(`rotating ${counts.Fatigued} creative yang fatigue`);
  if (counts.Loser > 0) recParts.push(`mengganti ${counts.Loser} creative underperforming`);
  const recommendation =
    recParts.length > 0
      ? `Saya rekomendasikan ${recParts.join(" dan ")} — request konsep baru dari Kai untuk menjaga momentum.`
      : counts.Winner + counts.Healthy > 0
        ? "Portofolio stabil — lanjutkan monitoring rutin, belum perlu rotasi creative."
        : "Kumpulkan delivery lebih banyak sebelum mengambil keputusan rotasi.";
  const keyInsights: string[] = [];
  const topPerformer = topCtrPerformerInsight(gallery);
  if (topPerformer) keyInsights.push(topPerformer);
  if (counts.Fatigued > 0) {
    const names = gallery
      .filter((g) => g.status === "Fatigued")
      .map((g) => g.ad.stableId)
      .join(", ");
    keyInsights.push(`${counts.Fatigued} creative menunjukkan tanda fatigue: ${names}.`);
  }
  keyInsights.push(...formatInsights);
  if (counts["Insufficient Data"] > 0)
    keyInsights.push(`${counts["Insufficient Data"]} creative belum cukup delivery untuk dinilai.`);
  return { posture, summary, recommendation, keyInsights };
}
