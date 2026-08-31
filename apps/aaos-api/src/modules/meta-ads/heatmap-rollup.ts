import {
  Rph,
  type Ad,
  type AdAccount,
  type AudienceLabel,
  type CreativeAsset,
} from "@aos/meta-ads-connector";

import type { HeatmapCellDto, HeatmapResponseDto } from "./dto/heatmap.dto.js";

/**
 * `getAudienceCreativeHeatmap` — AAOS Analytics Platform Phase 3, "Audience × Creative Heatmap".
 * Reuses `asset-rollup.ts`'s exact aggregation conventions (additive fields summed, `maxFrequency`
 * non-additive/MAX, the cell's own `cpl` recomputed via `Rph.calculate` from summed spend/totalLead
 * — never summed from per-ad rates), just keyed by BOTH a real ad's `creativeAsset` (Phase 2) AND
 * its parent `AdSet.audienceLabel` (this phase's real `classifyAudience` wiring) instead of asset
 * alone. Not a third, parallel aggregation approach — see this file's docstring on each helper for
 * exactly which Phase 1/2 convention it restates.
 */

/** `classifyAudience`'s own real, documented bucket-priority order (`AudienceClassifier.ts`) — the heatmap grid's real row order, most-targeted-first. */
const AUDIENCE_LABEL_ORDER: readonly AudienceLabel[] = [
  "BROAD",
  "INTEREST",
  "LOOKALIKE_1",
  "RETARGETING",
  "CUSTOM_CRM",
];

interface MutableCell {
  readonly assetKind: CreativeAsset["kind"];
  readonly assetId: string;
  readonly audienceLabel: AudienceLabel;
  adCount: number;
  spend: number;
  impressions: number;
  clicks: number;
  totalLead: number;
  maxFrequency: number;
}

function assetIdOf(asset: CreativeAsset): string {
  return asset.kind === "IMAGE" ? asset.imageHash : asset.videoId;
}

function cellKey(asset: CreativeAsset, audienceLabel: AudienceLabel): string {
  return `${asset.kind}:${assetIdOf(asset)}::${audienceLabel}`;
}

interface AdWithAudience {
  readonly ad: Ad;
  readonly audienceLabel: AudienceLabel | undefined;
}

function everyAdWithAudience(adAccount: AdAccount): readonly AdWithAudience[] {
  const rows: AdWithAudience[] = [];
  for (const campaign of adAccount.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        rows.push({ ad, audienceLabel: adSet.audienceLabel });
      }
    }
  }
  return rows;
}

/**
 * Portfolio-wide average CPL — restates `CampaignTable.tsx`'s own `computePortfolioAvgCplIDR`
 * formula exactly (arithmetic mean of each real ad's own `metrics.rphLead`, never a single ratio
 * of pooled sums) server-side, since this endpoint already holds the full real `AdAccount` tree
 * that client-side proxy needed to reconstruct from a flattened DTO. Not a second, invented
 * benchmark concept — see `dto/heatmap.dto.ts`'s `benchmarkCplIDR` docstring.
 */
function computeBenchmarkCplIDR(rows: readonly AdWithAudience[]): number | null {
  const values = rows
    .map(({ ad }) => ad.metrics.rphLead.value)
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Same real, cited multiplier as `CampaignTable.tsx`'s `CPL_BENCHMARK_MULTIPLIER` / `scheduler`'s `HIGH_CPL_MULTIPLIER` — see those files' docstrings. */
const CPL_BENCHMARK_MULTIPLIER = 1.5;

/**
 * `generateHeatmapInsight` — pure, deterministic, template-based (per the design doc's explicit
 * instruction: this specific insight text is NEVER an LLM call, contrast Phase 4's real
 * Samantha/LLM insight). Reports the two real, concrete facts a human scanning a heatmap grid
 * would look for first: the single best-performing cell (lowest real CPL, with enough leads to be
 * meaningful) and any cell whose real CPL exceeds the portfolio benchmark by more than
 * `CPL_BENCHMARK_MULTIPLIER` — an honest "nothing stands out yet" when neither condition has
 * enough real data to report on, never a fabricated observation.
 */
export function generateHeatmapInsight(
  cells: readonly HeatmapCellDto[],
  benchmarkCplIDR: number | null,
): string {
  const withLeads = cells.filter((cell) => cell.cpl !== null && cell.totalLead > 0);
  if (withLeads.length === 0) {
    return "Belum ada cukup data lead untuk menghasilkan insight audiens × kreatif.";
  }

  const best = [...withLeads].sort((a, b) => (a.cpl ?? 0) - (b.cpl ?? 0))[0];
  const parts: string[] = [];
  if (best !== undefined) {
    parts.push(
      `Kombinasi kreatif ${best.assetId} × audiens ${best.audienceLabel} memiliki CPL terendah ` +
        `(Rp${Math.round(best.cpl ?? 0).toLocaleString("id-ID")}, ${best.totalLead} lead).`,
    );
  }

  if (benchmarkCplIDR !== null && benchmarkCplIDR > 0) {
    const worstOutliers = withLeads
      .filter((cell) => (cell.cpl ?? 0) > benchmarkCplIDR * CPL_BENCHMARK_MULTIPLIER)
      .sort((a, b) => (b.cpl ?? 0) - (a.cpl ?? 0));
    const worst = worstOutliers[0];
    if (worst !== undefined) {
      parts.push(
        `Kombinasi kreatif ${worst.assetId} × audiens ${worst.audienceLabel} berada di atas ` +
          `${CPL_BENCHMARK_MULTIPLIER}× rata-rata CPL portofolio — pertimbangkan untuk direview.`,
      );
    }
  }

  return parts.join(" ");
}

export function getAudienceCreativeHeatmap(adAccount: AdAccount, now: Date): HeatmapResponseDto {
  const rows = everyAdWithAudience(adAccount);
  const cellMap = new Map<string, MutableCell>();
  let untaggedAdCount = 0;

  for (const { ad, audienceLabel } of rows) {
    const asset = ad.creativeAsset;
    if (asset === undefined || audienceLabel === undefined) {
      untaggedAdCount += 1;
      continue;
    }

    const key = cellKey(asset, audienceLabel);
    const existing = cellMap.get(key);
    const cell: MutableCell =
      existing ??
      ({
        assetKind: asset.kind,
        assetId: assetIdOf(asset),
        audienceLabel,
        adCount: 0,
        spend: 0,
        impressions: 0,
        clicks: 0,
        totalLead: 0,
        maxFrequency: 0,
      } satisfies MutableCell);

    cell.adCount += 1;
    cell.spend += ad.metrics.spend.toNumber();
    cell.impressions += ad.metrics.impressions;
    cell.clicks += ad.metrics.clicks;
    cell.totalLead += ad.metrics.totalLead;
    cell.maxFrequency = Math.max(cell.maxFrequency, ad.metrics.frequency);

    cellMap.set(key, cell);
  }

  const cells: HeatmapCellDto[] = Array.from(cellMap.values())
    .map((cell): HeatmapCellDto => ({
      assetKind: cell.assetKind,
      assetId: cell.assetId,
      audienceLabel: cell.audienceLabel,
      adCount: cell.adCount,
      spend: cell.spend,
      impressions: cell.impressions,
      clicks: cell.clicks,
      totalLead: cell.totalLead,
      maxFrequency: cell.maxFrequency,
      ctr: cell.impressions > 0 ? cell.clicks / cell.impressions : null,
      cpm: cell.impressions > 0 ? (cell.spend / cell.impressions) * 1000 : null,
      cpl: Rph.calculate(cell.spend, cell.totalLead).value,
    }))
    // Highest spend first — same "most-consequential-first" ordering `asset-rollup.ts`'s own
    // `assets` array already uses.
    .sort((a, b) => b.spend - a.spend);

  const spendByAsset = new Map<string, number>();
  for (const cell of cells) {
    spendByAsset.set(cell.assetId, (spendByAsset.get(cell.assetId) ?? 0) + cell.spend);
  }
  const creativeAssetIds = Array.from(spendByAsset.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([assetId]) => assetId);

  const presentLabels = new Set(cells.map((cell) => cell.audienceLabel));
  const audienceLabels = AUDIENCE_LABEL_ORDER.filter((label) => presentLabels.has(label));

  const benchmarkCplIDR = computeBenchmarkCplIDR(rows);

  return {
    adAccountId: adAccount.id.toString(),
    generatedAt: now.toISOString(),
    cells,
    creativeAssetIds,
    audienceLabels,
    untaggedAdCount,
    benchmarkCplIDR,
    insightText: generateHeatmapInsight(cells, benchmarkCplIDR),
  };
}
