"use client";

import { useState } from "react";

import { CopyVariantList, type CopyVariant } from "@/components/analytics/CopyVariantList";
import { MetricCard } from "@/components/analytics/MetricCard";
import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatNumber } from "@/lib/formatters";
import type { AdSetSummaryDto, AdSummaryDto } from "@/types/dashboard.types";

import styles from "./CampaignDetailDrawer.module.css";

/**
 * Campaign/Ad Set/Ad detail drawer (Sprint 5 Prompt 11 dispatch, `/campaigns` "Aktif" tab row
 * click). Reuses the SAME `AdSetSummaryDto`/`AdSummaryDto` tree data `MetaAdsClient`/`CampaignTree`
 * already loaded for the Aktif tab — this component makes NO network call of its own, per the
 * spec's own explicit instruction ("JANGAN fetch ulang ke Meta di drawer ini, pakai data campaign
 * yang sudah di-load").
 *
 * Real data gaps found while investigating (`AdMetricsDto`, `apps/eyvra-dashboard/src/types/
 * dashboard.types.ts`) and how each is honestly degraded instead of fabricated:
 *  - No `impressions` field anywhere on the already-loaded ad/ad-set/campaign snapshot → no real
 *    CTR is computable here. Blok 2's metric grid and Blok 3's "Copy Variations" list both show
 *    real Spend/Total Lead/CPL (`rphLead`) instead of the spec's literal CTR/ROAS — see
 *    `buildCopyVariants` below.
 *  - No revenue field exists anywhere in this codebase (confirmed against `CampaignTable.tsx`'s own
 *    documented convention) → no real ROAS/Revenue metric card is rendered; those spec metrics are
 *    simply omitted rather than invented.
 *  - No historical time series exists for any of these metrics → `MetricCard`'s `sparkline`/`delta`
 *    props are left `undefined` here (see that component's own docstring for why).
 *  - No tracking-parameter field exists anywhere on `AdSummaryDto` → the "Tracking Parameters" note
 *    always renders the spec's own amber "not configured" copy (real code path, not a fabricated
 *    finding — this dashboard genuinely never pulls UTM/tracking params from Meta today).
 *  - Blok 4 "Audience Breakdown" needs a per-ad `audienceLabel` + sub-segment breakdown that only
 *    exists server-side on `HeatmapCellDto`/`AssetDetailResponseDto` (grouped by CREATIVE ASSET,
 *    fetched from a different, asset-scoped endpoint) — `AdSummaryDto` carries no `assetId` field to
 *    join against, and fetching that endpoint here would violate "pakai data yang sudah di-load".
 *    Rather than fabricate a fake join, this block honestly renders an empty state explaining the
 *    real gap.
 *
 * "Copy Variations" (Blok 3) real mapping: an ad set's own `ads` array already IS the real
 * creative-variant list (`CampaignTree`'s own docstring: "Ad Set → Ad (#A #B #C)" — sibling ads
 * under one ad set are literally Meta's real A/B/C creative variants) — reused directly, not a
 * fabricated grouping.
 */

export type DrawerTarget =
  | { readonly kind: "campaign"; readonly name: string; readonly stableId: string }
  | { readonly kind: "adset"; readonly name: string; readonly stableId: string }
  | { readonly kind: "ad"; readonly name: string; readonly stableId: string };

export interface CampaignDetailDrawerProps {
  readonly target: DrawerTarget;
  readonly status: string;
  readonly verdict: string;
  readonly adSet: AdSetSummaryDto;
  readonly focusAd?: AdSummaryDto;
  readonly onClose: () => void;
}

type SortMode = "cpl" | "spend" | "lead";

const SORT_LABELS: Readonly<Record<SortMode, string>> = {
  cpl: "CPL",
  spend: "Spend",
  lead: "Total Lead",
};

function buildCopyVariants(ads: readonly AdSummaryDto[], sort: SortMode): readonly CopyVariant[] {
  const variants: CopyVariant[] = ads.map((ad) => ({
    id: ad.id,
    name: `${ad.stableId} · ${stripAdNameSuffix(ad.name)}`,
    copyPreview: stripAdNameSuffix(ad.name),
    metrics: [
      { label: "SPEND", value: ad.metrics.spend, format: "idr" },
      { label: "LEAD", value: ad.metrics.totalLead, format: "number" },
      { label: "CPL", value: ad.metrics.rphLead ?? 0, format: "idr" },
    ],
    rankValue:
      sort === "cpl"
        ? (ad.metrics.rphLead ?? Number.POSITIVE_INFINITY)
        : sort === "spend"
          ? ad.metrics.spend
          : ad.metrics.totalLead,
    rankDirection: sort === "cpl" ? "lowerIsBetter" : "higherIsBetter",
  }));
  return [...variants].sort((a, b) =>
    a.rankDirection === "lowerIsBetter" ? a.rankValue - b.rankValue : b.rankValue - a.rankValue,
  );
}

export function CampaignDetailDrawer({
  target,
  status,
  verdict,
  adSet,
  focusAd,
  onClose,
}: CampaignDetailDrawerProps): React.ReactElement {
  const [sort, setSort] = useState<SortMode>("cpl");
  const metricAd = focusAd ?? adSet.ads[0];
  const copyVariants = buildCopyVariants(adSet.ads, sort);

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Detail ${target.name}`}
        data-testid="campaign-detail-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        {/* BLOK 1 — Header */}
        <header className={styles.header}>
          <div className={styles.headerBadges}>
            <span className={styles.typeBadge}>{target.kind === "ad" ? "Ad" : "Ad Set"}</span>
            <span className={styles.statusBadge}>{status}</span>
            <VerdictBadge verdict={verdict} />
            <span className={styles.countBadge}>{adSet.ads.length} ad</span>
          </div>
          <div className={styles.headerRow}>
            <h2 className={styles.title}>{stripAdNameSuffix(target.name)}</h2>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Tutup"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </header>

        {/* BLOK 2 — Preview + Metric Grid */}
        <section className={styles.section}>
          <div className={styles.previewGrid}>
            <div className={styles.previewThumb} aria-hidden="true">
              {/* No real creative image URL exists on this snapshot (only Meta's `image_hash`/
                  `video_id` identifiers server-side) — an honest placeholder, not a fabricated
                  image, per this drawer's own docstring. */}
              <span className={styles.previewPlaceholder}>🖼</span>
            </div>
            <div className={styles.metricGrid}>
              {metricAd !== undefined ? (
                <>
                  <MetricCard label="SPEND" value={formatIdr(metricAd.metrics.spend)} />
                  <MetricCard
                    label="POST ENGAGEMENT"
                    value={formatNumber(metricAd.metrics.conversations)}
                  />
                  <MetricCard
                    label="COST PER ENGAGEMENT"
                    value={
                      metricAd.metrics.conversations > 0
                        ? formatIdr(metricAd.metrics.spend / metricAd.metrics.conversations)
                        : "—"
                    }
                  />
                  <MetricCard label="TOTAL LEAD" value={formatNumber(metricAd.metrics.totalLead)} />
                  <MetricCard
                    label="CPL"
                    value={
                      metricAd.metrics.rphLead !== null ? formatIdr(metricAd.metrics.rphLead) : "—"
                    }
                  />
                  <MetricCard label="D3" value={formatNumber(metricAd.metrics.d3)} />
                </>
              ) : null}
            </div>
          </div>
          <p className={styles.trackingNote} data-testid="tracking-note">
            ⚠ No tracking parameters configured.
          </p>
        </section>

        {/* BLOK 3 — Copy Variations */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Copy Variations</h3>
            <label className={styles.sortLabel}>
              Sort by{" "}
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
                className={styles.sortSelect}
                aria-label="Sort copy variations"
              >
                {(Object.keys(SORT_LABELS) as SortMode[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
              ▾
            </label>
          </div>
          <CopyVariantList variants={copyVariants} />
        </section>

        {/* BLOK 4 — Audience Breakdown */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Audience Breakdown (0)</h3>
          <p className={styles.honestEmpty} data-testid="audience-breakdown-empty">
            Data belum tersedia — payload campaign yang sudah dimuat di tab Aktif belum menyertakan
            audience label / sub-segment per ad (hanya tersedia per creative asset di endpoint
            heatmap terpisah).
          </p>
        </section>
      </aside>
    </div>
  );
}

export default CampaignDetailDrawer;
