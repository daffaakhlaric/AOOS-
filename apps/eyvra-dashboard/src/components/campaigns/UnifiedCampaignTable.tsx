"use client";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { EmptyState } from "@/components/ui/EmptyState";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

import {
  aggregateCampaign,
  computeCpl,
  cpcFromAggregate,
  cplTone,
  cpmFromAggregate,
  ctrFromAggregate,
  isFrequencyWarning,
} from "./campaignInsightMath";
import { StatusToggle } from "./StatusToggle";
import styles from "./UnifiedCampaignTable.module.css";

export interface UnifiedCampaignTableProps {
  readonly campaigns: readonly CampaignSummaryDto[];
  readonly benchmarkCplIDR: number | null;
  readonly selectedCampaignId: string | undefined;
  readonly onSelect: (campaignId: string) => void;
  readonly onPause: (campaignId: string) => void;
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — the new unified page's ONE campaign table (spec's "SATU tabel
 * dengan semua kolom: toggle, budget, spend, CPL (colored pill), frequency, kolom 'Samantha'
 * verdict"), replacing `CampaignTree`'s 3-level expand/collapse hierarchy for THIS page's purpose
 * (`CampaignTree` itself is untouched and still powers the real per-ad-set/ad drill-down inside
 * `CampaignInsightPanel`'s "detail" affordance — see that component's own doc).
 *
 * Real, honest column decisions:
 * - "Daily Budget": real (`AdSetSummaryDto.dailyBudget`, Meta's real per-ad-set daily cap, summed
 *   across this campaign's real ad sets) — this was a genuine gap fixed for the AdAdvisor-style
 *   table (user-requested "data table campaign nya lengkap gini kaya di adavisor"): `aaos-api`
 *   already pulled this field, this app's `/api/campaigns` proxy just never forwarded it. There is
 *   still no per-campaign *lifetime* budget CAP field anywhere in Meta's real data for this
 *   account (a genuinely different, still-absent concept from the daily budget here).
 * - CPL/CPA pill: real `spend / totalLead` colored via `cplTone` (green < 85% of the real
 *   benchmark, amber 85-115%, red > 115%, neutral "unknown" pill when no real benchmark/CPL exists
 *   yet).
 * - Impressions/Reach/CTR/CPC/CPM: real, already-pulled Meta delivery metrics
 *   (`AdMetricsDto.impressions`/`.reach`, summed; CTR/CPC/CPM derived via `campaignInsightMath.ts`'s
 *   own pure functions) — `—` (never a fabricated 0) when no ad in the campaign carries a real
 *   value for that field yet.
 * - Frequency: real max per-ad frequency (`aggregateCampaign`), a red "⚠" badge above the real
 *   3.5 threshold (same threshold `MetricsTab.tsx`/`AuditClient.tsx` already use).
 * - "Samantha" verdict column: the SAME real `aggregateVerdict` precedence `CampaignTree.tsx`
 *   already computes from this campaign's own real per-ad `VerdictEngine` outputs — never a second,
 *   parallel classification invented for this table.
 * - Deliberately OMITTED vs. the AdAdvisor reference: Revenue/ROAS/AOV and the e-commerce funnel
 *   (View Content/Add to Cart/Init. Checkout/Purchases) — this tenant's real Meta pull carries no
 *   revenue/purchase/e-commerce pixel data at all (a WhatsApp lead-gen funnel, not e-commerce), so
 *   those columns would be fabricated numbers with nothing real behind them. "Results" here is the
 *   real WhatsApp-funnel equivalent (`totalLead`), not a landing-page-view count Meta never reports
 *   for this account's real objective/pixel setup.
 */
export function UnifiedCampaignTable({
  campaigns,
  benchmarkCplIDR,
  selectedCampaignId,
  onSelect,
  onPause,
}: UnifiedCampaignTableProps): React.ReactElement {
  if (campaigns.length === 0) {
    return (
      <EmptyState
        title="Tidak ada campaign"
        description="Coba kata kunci lain atau tarik data baru."
      />
    );
  }

  let totalSpend = 0;
  let totalLead = 0;

  return (
    <div className={styles.tableWrap}>
      <table data-testid="unified-campaign-table" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Campaign</th>
            <th scope="col">Daily Budget</th>
            <th scope="col">Spend</th>
            <th scope="col">Results</th>
            <th scope="col">CPA</th>
            <th scope="col">Impressions</th>
            <th scope="col">Reach</th>
            <th scope="col">CTR</th>
            <th scope="col">CPC</th>
            <th scope="col">CPM</th>
            <th scope="col">Frequency</th>
            <th scope="col">Samantha</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const aggregate = aggregateCampaign(campaign);
            const cpl = computeCpl(aggregate.spend, aggregate.totalLead);
            const tone = cplTone(cpl, benchmarkCplIDR);
            const ctr = ctrFromAggregate(aggregate);
            const cpc = cpcFromAggregate(aggregate);
            const cpm = cpmFromAggregate(aggregate);
            const freqWarning = isFrequencyWarning(aggregate.maxFrequency);
            const verdict = aggregateVerdict(
              campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.verdict)),
            );
            // AAOS Samantha Professional Optimizer, Part A/D — real Meta Learning Phase signal:
            // true when AT LEAST ONE of this campaign's real adsets is still `LEARNING` (Meta's
            // own `learning_stage_info.status`, undefined when Meta didn't report one — see
            // `AdSetSummaryDto.learningStatus`'s own doc). Campaign-level (not per-adset) since
            // this table is campaign-level — a mixed campaign still deserves the caution flag.
            const isLearning = campaign.adSets.some((adSet) => adSet.learningStatus === "LEARNING");
            totalSpend += aggregate.spend;
            totalLead += aggregate.totalLead;
            const isSelected = campaign.id === selectedCampaignId;
            return (
              <tr
                key={campaign.id}
                data-testid={`campaign-row-${campaign.id}`}
                className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                onClick={() => onSelect(campaign.id)}
              >
                <td onClick={(event) => event.stopPropagation()}>
                  <StatusToggle status={campaign.status} onPause={() => onPause(campaign.id)} />
                </td>
                <td className={styles.nameCell}>
                  <span className={styles.name}>{stripAdNameSuffix(campaign.name)}</span>
                  {isLearning ? (
                    <span
                      data-testid="learning-phase-badge"
                      className={styles.learningBadge}
                      title="Ada ad set yang masih dalam Learning Phase Meta — evaluasi performa sebenarnya baru akurat setelah keluar dari fase ini."
                    >
                      🎓 Learning
                    </span>
                  ) : null}
                  <span className={styles.meta}>
                    {campaign.stableId} · {aggregate.adSetCount} ad set · {aggregate.adCount} iklan
                  </span>
                </td>
                <td data-testid={`daily-budget-${campaign.id}`}>
                  {aggregate.dailyBudget > 0 ? formatIdr(aggregate.dailyBudget) : "—"}
                </td>
                <td>{formatIdr(aggregate.spend)}</td>
                <td data-testid={`results-${campaign.id}`}>{formatNumber(aggregate.totalLead)}</td>
                <td>
                  <span
                    data-testid="cpl-pill"
                    data-tone={tone}
                    className={`${styles.cplPill} ${styles[`cpl${capitalize(tone)}`]}`}
                  >
                    {cpl !== null ? formatIdr(cpl) : "—"}
                  </span>
                </td>
                <td data-testid={`impressions-${campaign.id}`}>
                  {aggregate.impressions !== null ? formatNumber(aggregate.impressions) : "—"}
                </td>
                <td data-testid={`reach-${campaign.id}`}>
                  {aggregate.reach !== null ? formatNumber(aggregate.reach) : "—"}
                </td>
                <td data-testid={`ctr-${campaign.id}`}>
                  {ctr !== null ? formatPercent(ctr) : "—"}
                </td>
                <td data-testid={`cpc-${campaign.id}`}>{cpc !== null ? formatIdr(cpc) : "—"}</td>
                <td data-testid={`cpm-${campaign.id}`}>{cpm !== null ? formatIdr(cpm) : "—"}</td>
                <td>
                  <span className={styles.frequencyCell}>
                    {aggregate.maxFrequency.toFixed(2)}
                    {freqWarning ? (
                      <span
                        data-testid="frequency-warning"
                        aria-label="Frequency tinggi"
                        className={styles.frequencyWarning}
                      >
                        ⚠
                      </span>
                    ) : null}
                  </span>
                </td>
                <td>
                  <VerdictBadge verdict={verdict} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr data-testid="campaign-table-total-row" className={styles.totalRow}>
            <td colSpan={3}>Total ({campaigns.length} campaign)</td>
            <td>{formatIdr(totalSpend)}</td>
            <td>{formatNumber(totalLead)}</td>
            <td colSpan={8} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
}

export default UnifiedCampaignTable;
