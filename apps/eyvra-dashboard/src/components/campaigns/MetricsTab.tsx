"use client";

import { useMemo, useState } from "react";

import { MetricCard } from "@/components/analytics/MetricCard";
import { DateRangeSelector } from "@/components/meta-ads/DateRangeSelector";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type { AdSummaryDto, CampaignSummaryDto } from "@/types/dashboard.types";

import styles from "./MetricsTab.module.css";

/**
 * Sprint 5 Prompt 13 — Campaigns "Metrics" tab (first tab, before "Aktif").
 *
 * REAL FILE LOCATION vs the spec's literal path: the spec asked for
 * `app/property/campaigns/tabs/MetricsTab.tsx`. This app has no `/property/*` route prefix at all
 * (confirmed by `4e76775`'s own docstring and every earlier phase this sprint) and no route ever
 * renders a tab from a standalone `tabs/*.tsx` file — every "Campaign" tab (`Aktif`/`Verdict`/`A-B
 * Testing`/`Anggaran`/`Objective`) is a plain component imported and switched on inside
 * `CampaignsHubClient.tsx` (`src/components/campaigns/CampaignsHubClient.tsx`), the real single
 * route behind `/campaigns`. This file follows that same real, existing convention instead of
 * inventing a new `tabs/` folder or a `/property` route nothing else in this app uses.
 *
 * REAL DATA SOURCE: the exact same `useCampaignsSnapshot()` hook / `/api/campaigns` snapshot
 * (`AdAccountSummaryDto`) the "Aktif" tab (`MetaAdsClient` → `CampaignTree`) already reads — per
 * the spec's own "JANGAN buat query/tabel baru" instruction. The spec's literal
 * `campaign_daily_metrics` table does not exist anywhere in `apps/aaos-api` (confirmed by a
 * repo-wide search) — there is no per-day metrics table for any campaign in this codebase at all,
 * only this one point-in-time snapshot per `datePreset` (`last_7d`/`last_14d`/`last_30d`). This is
 * the real, closest-available analog, not a fabricated substitute.
 *
 * HONEST DATA-AVAILABILITY FINDINGS (never fabricated — degraded per this dispatch's discipline):
 *  - Total Revenue / ROAS: NO revenue field exists anywhere in this codebase for any real Meta ad
 *    (same finding `4e76775`'s `WinningCombos.tsx`/`CampaignDetailDrawer.tsx` already documented) —
 *    both cards are omitted entirely rather than showing a fabricated number.
 *  - Impressions / CTR / CPM: `4e76775` found no `impressions` field on the loaded ad snapshot at
 *    the time. Investigating further for this dispatch found the real backend
 *    (`AdMetricsResponseDto` in `apps/aaos-api`) already returns a real per-ad `impressions` value
 *    that this app's `/api/campaigns` proxy simply never forwarded — the exact same class of gap
 *    `rphLead`'s own docstring documents ("already computed server-side but never plumbed
 *    through"). This dispatch plumbs it through (`AdMetricsDto.impressions`, optional, see that
 *    type's docstring) so Impressions/CTR/CPM can be shown as REAL derived metrics, not fabricated.
 *  - Sparkline / delta (%): the data source is one point-in-time snapshot per `datePreset`, not a
 *    daily time series — there is no historical value to diff against. Every `MetricCard` below
 *    omits both `sparkline` and `delta` (same honest-omission discipline as `MetricCard`'s own
 *    docstring). The spec's "Frequency > 3.5 → delta badge jadi warning amber" is instead rendered
 *    as a plain, real, value-threshold warning badge (`MetricCard`'s new `warningLabel` prop) —
 *    the honest analog of a delta-driven warning when no delta exists.
 *  - Cost per Result / Total Results: this domain's real "hasil" concept is a lead
 *    (`AdMetricsDto.totalLead`), the same concept `rphLead`/CPL already use everywhere else in this
 *    app — "Cost per Result" is `spend / totalLead` (the real `rphLead`), not a fabricated
 *    e-commerce "purchase" concept this codebase has no data for.
 *  - Click Conversion Rate: `totalLead / clicks` — a real, derived ratio from already-loaded data,
 *    following the same "derived ratio, not summed rate" convention `CampaignFunnelBar.tsx` and
 *    `heatmap-rollup.ts` already use for CTR/CPM/CPL.
 *  - Conversion Funnel: the spec's literal "Impressions → Clicks → View Content → Add to Cart →
 *    Checkout → Purchase" is Meta's standard E-COMMERCE funnel — this tenant runs a LEAD-GEN
 *    funnel with no such fields anywhere (no view-content/cart/checkout/purchase events exist in
 *    `@aos/meta-ads-connector` at all). The real funnel this codebase already tracks and displays
 *    everywhere else (`CampaignFunnelBar.tsx`) is Impressions → Klik → Chat → D2 → D3 → D5 → Form →
 *    Total Lead — reused here with the same real fields and the same "% of previous step" /
 *    proportional-bar math the spec asks for, rather than fabricating e-commerce steps this
 *    tenant's data can never populate.
 *  - Spend vs Revenue dual-line chart: requires BOTH a daily time series (not available — see
 *    above) AND a revenue field (not available — see above). Two independent real gaps, not one —
 *    honestly degraded to an explanatory empty state rather than a fabricated chart with invented
 *    numbers.
 *
 * Date range: reuses the exact same real `DateRangeSelector` component / `datePreset` enum
 * (`last_7d`/`last_14d`/`last_30d`) `MetaAdsClient.tsx` already uses — `GET /api/v1/campaigns`
 * accepts no other date-range shape (same judgment call `DateRangeSelector`'s own docstring
 * documents), so a literal from/to calendar picker would control a param the backend cannot honor.
 * Default is `last_30d` per spec.
 */

const FREQUENCY_WARNING_THRESHOLD = 3.5;

export interface AggregatedMetrics {
  readonly spend: number;
  readonly clicks: number;
  readonly totalLead: number;
  readonly impressions: number | undefined;
  /** MAX across ads — non-additive, same convention `heatmap-rollup.ts`'s `maxFrequency` uses. */
  readonly maxFrequency: number;
  readonly adCount: number;
}

/** Pure, exported for tests: aggregates real per-ad metrics for whatever scope (account-wide, or one campaign) the user has selected. Every field is a real sum/max of already-loaded data — nothing is estimated. */
export function aggregateAdMetrics(ads: readonly AdSummaryDto[]): AggregatedMetrics {
  let spend = 0;
  let clicks = 0;
  let totalLead = 0;
  let impressionsSum = 0;
  let impressionsKnown = false;
  let maxFrequency = 0;
  for (const ad of ads) {
    spend += ad.metrics.spend;
    clicks += ad.metrics.clicks;
    totalLead += ad.metrics.totalLead;
    if (ad.metrics.impressions !== undefined) {
      impressionsSum += ad.metrics.impressions;
      impressionsKnown = true;
    }
    maxFrequency = Math.max(maxFrequency, ad.metrics.frequency);
  }
  return {
    spend,
    clicks,
    totalLead,
    impressions: impressionsKnown ? impressionsSum : undefined,
    maxFrequency,
    adCount: ads.length,
  };
}

function flattenCampaignAds(campaign: CampaignSummaryDto): readonly AdSummaryDto[] {
  return campaign.adSets.flatMap((adSet) => adSet.ads);
}

function costPerResult(spend: number, totalLead: number): number | null {
  return totalLead > 0 ? spend / totalLead : null;
}

function ctr(clicks: number, impressions: number | undefined): number | null {
  return impressions !== undefined && impressions > 0 ? clicks / impressions : null;
}

function cpm(spend: number, impressions: number | undefined): number | null {
  return impressions !== undefined && impressions > 0 ? (spend / impressions) * 1000 : null;
}

function cpc(spend: number, clicks: number): number | null {
  return clicks > 0 ? spend / clicks : null;
}

function clickConversionRate(totalLead: number, clicks: number): number | null {
  return clicks > 0 ? totalLead / clicks : null;
}

interface FunnelStep {
  readonly label: string;
  readonly value: number;
}

/** Real Impressions→Klik→Chat→D2→D3→D5→Form→Total Lead funnel — see this file's own docstring on why this replaces the spec's literal e-commerce steps. Proportional to the widest available step (Impressions when known, else Klik), per spec. */
function buildFunnelSteps(
  ads: readonly AdSummaryDto[],
  impressions: number | undefined,
): readonly FunnelStep[] {
  let clicks = 0;
  let conversations = 0;
  let d2 = 0;
  let d3 = 0;
  let d5 = 0;
  let leadForm = 0;
  let totalLead = 0;
  for (const ad of ads) {
    clicks += ad.metrics.clicks;
    conversations += ad.metrics.conversations;
    d2 += ad.metrics.d2;
    d3 += ad.metrics.d3;
    d5 += ad.metrics.d5;
    leadForm += ad.metrics.leadForm;
    totalLead += ad.metrics.totalLead;
  }
  const steps: FunnelStep[] = [];
  if (impressions !== undefined) {
    steps.push({ label: "Impressions", value: impressions });
  }
  steps.push({ label: "Klik", value: clicks });
  steps.push({ label: "Chat", value: conversations });
  steps.push({ label: "D2", value: d2 });
  steps.push({ label: "D3", value: d3 });
  steps.push({ label: "D5", value: d5 });
  steps.push({ label: "Form", value: leadForm });
  steps.push({ label: "Total Lead", value: totalLead });
  return steps;
}

export function MetricsTab(): React.ReactElement {
  const { data, loading, error, period, pull } = useCampaignsSnapshot();
  const [datePreset, setDatePreset] = useState("last_30d");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const campaigns = useMemo(() => data?.campaigns ?? [], [data]);
  const filteredCampaigns = useMemo(
    () =>
      search.trim().length === 0
        ? campaigns
        : campaigns.filter((campaign) =>
            campaign.name.toLowerCase().includes(search.trim().toLowerCase()),
          ),
    [campaigns, search],
  );

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);
  const scopedAds = useMemo(
    () =>
      selectedCampaign !== undefined ? flattenCampaignAds(selectedCampaign) : (data?.ads ?? []),
    [selectedCampaign, data],
  );
  const aggregated = useMemo(() => aggregateAdMetrics(scopedAds), [scopedAds]);

  if (data === undefined && !loading && error === undefined) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="Belum ada data campaign"
          description="Tarik data dulu dari tab Aktif untuk melihat Metrics."
        />
      </div>
    );
  }

  const cpr = costPerResult(aggregated.spend, aggregated.totalLead);
  const realCtr = ctr(aggregated.clicks, aggregated.impressions);
  const realCpm = cpm(aggregated.spend, aggregated.impressions);
  const realCpc = cpc(aggregated.spend, aggregated.clicks);
  const realClickConv = clickConversionRate(aggregated.totalLead, aggregated.clicks);
  const funnelSteps = buildFunnelSteps(scopedAds, aggregated.impressions);
  const funnelBase = funnelSteps[0]?.value ?? 0;

  return (
    <div className={styles.wrap} data-testid="metrics-tab">
      <div className={styles.header}>
        <div className={styles.selectorGroup}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari campaign…"
            aria-label="Cari campaign"
            className={styles.search}
          />
          <select
            value={selectedCampaignId ?? ""}
            onChange={(event) =>
              setSelectedCampaignId(event.target.value.length > 0 ? event.target.value : undefined)
            }
            className={styles.select}
            aria-label="Pilih campaign"
            data-testid="metrics-campaign-select"
          >
            <option value="">Account (semua campaign)</option>
            {filteredCampaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
                {campaign.spend === 0 ? " · NO SPEND" : ""}
              </option>
            ))}
          </select>
        </div>
        <DateRangeSelector
          value={datePreset}
          onChange={(preset) => {
            setDatePreset(preset);
            void pull(preset);
          }}
        />
      </div>

      {loading ? <LoadingSpinner /> : null}
      {!loading && error !== undefined ? <ErrorCard message={error} /> : null}

      {!loading && data !== undefined ? (
        <>
          {period !== undefined ? <p className={styles.periodNote}>Periode: {period}</p> : null}

          {/* PRIMARY METRICS */}
          <section className={styles.grid4} data-testid="metrics-primary-grid">
            <MetricCard
              label="Total Spend"
              value={formatIdr(aggregated.spend)}
              testId="metric-spend"
            />
            <MetricCard label="Total Revenue" value="Belum tersedia" testId="metric-revenue" />
            <MetricCard label="ROAS" value="Belum tersedia" testId="metric-roas" />
            <MetricCard
              label="Cost per Result"
              value={cpr !== null ? formatIdr(cpr) : "—"}
              testId="metric-cpr"
            />
            <MetricCard
              label="Total Results"
              value={formatNumber(aggregated.totalLead)}
              testId="metric-results"
            />
            <MetricCard
              label="CTR"
              value={realCtr !== null ? formatPercent(realCtr) : "Belum tersedia"}
              testId="metric-ctr"
            />
            <MetricCard
              label="Impressions"
              value={
                aggregated.impressions !== undefined
                  ? formatNumber(aggregated.impressions)
                  : "Belum tersedia"
              }
              testId="metric-impressions"
            />
            <MetricCard
              label="Frequency"
              value={aggregated.maxFrequency.toFixed(2)}
              warningLabel={
                aggregated.maxFrequency > FREQUENCY_WARNING_THRESHOLD ? "Audiens jenuh" : undefined
              }
              testId="metric-frequency"
            />
          </section>

          {/* SECONDARY METRICS */}
          <section className={styles.grid4Small} data-testid="metrics-secondary-grid">
            <MetricCard
              label="CPM"
              value={realCpm !== null ? formatIdr(realCpm) : "Belum tersedia"}
              testId="metric-cpm"
            />
            <MetricCard
              label="CPC"
              value={realCpc !== null ? formatIdr(realCpc) : "—"}
              testId="metric-cpc"
            />
            <MetricCard
              label="Total Clicks"
              value={formatNumber(aggregated.clicks)}
              testId="metric-clicks"
            />
            <MetricCard
              label="Click Conversion Rate"
              value={realClickConv !== null ? formatPercent(realClickConv) : "—"}
              testId="metric-click-conv"
            />
          </section>

          {/* CONVERSION FUNNEL */}
          <section className={styles.funnelCard} data-testid="metrics-funnel">
            <h3 className={styles.sectionTitle}>Conversion Funnel</h3>
            <p className={styles.honestNote}>
              Funnel real tenant ini (Impressions → Klik → Chat → D2/D3/D5 → Form → Total Lead) —
              bukan funnel e-commerce (View Content/Add to Cart/Checkout/Purchase) karena tidak ada
              data event tersebut di Meta Ads untuk lead-gen automotive/property. Lihat docstring
              file ini untuk detail.
            </p>
            <div className={styles.funnelList}>
              {funnelSteps.map((step, index) => {
                const pct = funnelBase > 0 ? Math.round((step.value / funnelBase) * 100) : 0;
                const previous = index > 0 ? funnelSteps[index - 1] : undefined;
                const stepConversion =
                  previous !== undefined && previous.value > 0
                    ? Math.round((step.value / previous.value) * 100)
                    : undefined;
                return (
                  <div key={step.label} className={styles.funnelRow}>
                    <span className={styles.funnelLabel}>{step.label}</span>
                    <div className={styles.funnelBarTrack}>
                      <div className={styles.funnelBarFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.funnelValue}>
                      {formatNumber(step.value)}
                      {stepConversion !== undefined ? ` · ${stepConversion}%` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SPEND VS REVENUE CHART */}
          <section className={styles.chartCard} data-testid="metrics-spend-revenue-chart">
            <h3 className={styles.sectionTitle}>Spend vs Revenue</h3>
            <EmptyState
              title="Belum tersedia"
              description="Butuh dua data real yang belum ada: (1) time-series harian per campaign — sumber data ini hanya snapshot satu periode (last_7d/14d/30d), bukan deret harian; (2) field revenue — tidak ada field revenue di manapun untuk data Meta Ads tenant ini. Menampilkan chart di sini akan berarti mengarang angka, jadi sengaja tidak ditampilkan."
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

export default MetricsTab;
