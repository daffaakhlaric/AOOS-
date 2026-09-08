"use client";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { EmptyState } from "@/components/ui/EmptyState";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatNumber } from "@/lib/formatters";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

import { aggregateCampaign, computeCpl, cplTone, isFrequencyWarning } from "./campaignInsightMath";
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
 * - "Budget" column: NO real per-campaign budget-cap field exists anywhere in this codebase
 *   (confirmed by `02c475f`'s own investigation, restated here — no field on `CampaignSummaryDto`/
 *   `AdSetSummaryDto`/`AdMetricsDto` anywhere) — renders "—" with a title attribute explaining the
 *   real gap, never a fabricated cap. "Spend" is real (`campaign.spend`, `aaos-api`'s own
 *   spend-sorted `StableIdAssigner` total).
 * - CPL pill: real `spend / totalLead` colored via `cplTone` (green < 85% of the real benchmark,
 *   amber 85-115%, red > 115%, neutral "unknown" pill when no real benchmark/CPL exists yet).
 * - Frequency: real max per-ad frequency (`aggregateCampaign`), a red "⚠" badge above the real
 *   3.5 threshold (same threshold `MetricsTab.tsx`/`AuditClient.tsx` already use).
 * - "Samantha" verdict column: the SAME real `aggregateVerdict` precedence `CampaignTree.tsx`
 *   already computes from this campaign's own real per-ad `VerdictEngine` outputs — never a second,
 *   parallel classification invented for this table.
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
            <th scope="col">Budget</th>
            <th scope="col">Spend</th>
            <th scope="col">CPL</th>
            <th scope="col">Frequency</th>
            <th scope="col">Samantha</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const aggregate = aggregateCampaign(campaign);
            const cpl = computeCpl(aggregate.spend, aggregate.totalLead);
            const tone = cplTone(cpl, benchmarkCplIDR);
            const freqWarning = isFrequencyWarning(aggregate.maxFrequency);
            const verdict = aggregateVerdict(
              campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.verdict)),
            );
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
                  <span className={styles.meta}>
                    {campaign.stableId} · {aggregate.adSetCount} ad set · {aggregate.adCount} iklan
                  </span>
                </td>
                <td
                  className={styles.budgetCell}
                  title="Tidak ada field budget per-campaign yang real di data Meta Ads saat ini."
                >
                  —
                </td>
                <td>{formatIdr(aggregate.spend)}</td>
                <td>
                  <span
                    data-testid="cpl-pill"
                    data-tone={tone}
                    className={`${styles.cplPill} ${styles[`cpl${capitalize(tone)}`]}`}
                  >
                    {cpl !== null ? formatIdr(cpl) : "—"}
                  </span>
                </td>
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
            <td colSpan={2}>{formatNumber(totalLead)} lead</td>
            <td />
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
