"use client";

import { useMemo, useState } from "react";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { EmptyState } from "@/components/ui/EmptyState";
import { splitCampaignDisplayName } from "@/lib/adName";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

import {
  aggregateCampaign,
  classifyHealthBucket,
  computeCpl,
  cpcFromAggregate,
  cplTone,
  cpmFromAggregate,
  ctrFromAggregate,
  isFrequencyWarning,
  type HealthBucket,
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

type SortKey = "spend" | "cpl" | "results" | "frequency";
type SortDir = "asc" | "desc";

const BUCKET_ORDER: readonly HealthBucket[] = ["urgent", "attention", "healthy"];

const BUCKET_LABEL: Record<HealthBucket, string> = {
  urgent: "🔴 Urgent",
  attention: "🟡 Perlu Perhatian",
  healthy: "🟢 Sehat",
};

interface CampaignRow {
  readonly campaign: CampaignSummaryDto;
  readonly aggregate: ReturnType<typeof aggregateCampaign>;
  readonly cpl: number | null;
  readonly tone: ReturnType<typeof cplTone>;
  readonly ctr: number | null;
  readonly cpc: number | null;
  readonly cpm: number | null;
  readonly freqWarning: boolean;
  readonly verdict: string;
  readonly isLearning: boolean;
  readonly bucket: HealthBucket;
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
 *   yet) — now with a real ratio-vs-benchmark visual bar underneath (Campaign Page Rebuild v2),
 *   the same real ratio math `CampaignInsightPanel`'s own CPL bar block uses.
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
 *
 * Campaign Page Rebuild v2 (Prompt 1) additions:
 * - Rows are grouped into real urgent/attention/healthy sections (`classifyHealthBucket`, reusing
 *   the SAME `cplTone`/`isFrequencyWarning`/verdict boundaries already shown per-row — a row's
 *   bucket can never contradict its own visible pill/badge). Empty buckets render no section at
 *   all (never an empty "0 campaign" header).
 * - Spend/CPL/Results/Frequency column headers are sortable (client-side, within each bucket —
 *   sorting never moves a campaign OUT of its real health bucket).
 * - Campaign names route through `splitCampaignDisplayName` for the real email+timestamp
 *   auto-naming convention on top of the existing UUID-suffix stripping.
 * - Deliberately DEFERRED from the pasted spec, both for real reasons: (1) a per-row 7-day
 *   sparkline — the real per-campaign history endpoint now exists
 *   (`GET /campaigns/:campaignId/history`, Campaign Page Rebuild v2 Phase 0/1) and IS rendered in
 *   `CampaignInsightPanel` for the one selected campaign, but rendering it in EVERY row of this
 *   table would mean one history fetch per visible campaign (N+1), a real cost this table doesn't
 *   yet have a batched-history endpoint to avoid. (2) the pause-toggle "who/when paused" tooltip —
 *   `pausedAt`/`pausedBy` genuinely don't exist as fields anywhere in this schema; the existing
 *   `StatusToggle` already surfaces the real, honest constraint instead (no fabricated audit
 *   trail). (3) a separate hover-reveal "quick actions" affordance — the real, only-real mutating
 *   action available at this level (`PAUSE`, via `StatusToggle`) is already always-visible in the
 *   Status column; hiding it behind hover and re-adding it elsewhere would add a second control
 *   for the same one real action, not a new capability.
 */
export function UnifiedCampaignTable({
  campaigns,
  benchmarkCplIDR,
  selectedCampaignId,
  onSelect,
  onPause,
}: UnifiedCampaignTableProps): React.ReactElement {
  const [sortKey, setSortKey] = useState<SortKey | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo<readonly CampaignRow[]>(
    () =>
      campaigns.map((campaign) => {
        const aggregate = aggregateCampaign(campaign);
        const cpl = computeCpl(aggregate.spend, aggregate.totalLead);
        const tone = cplTone(cpl, benchmarkCplIDR);
        const verdict = aggregateVerdict(
          campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.verdict)),
        );
        return {
          campaign,
          aggregate,
          cpl,
          tone,
          ctr: ctrFromAggregate(aggregate),
          cpc: cpcFromAggregate(aggregate),
          cpm: cpmFromAggregate(aggregate),
          freqWarning: isFrequencyWarning(aggregate.maxFrequency),
          verdict,
          isLearning: campaign.adSets.some((adSet) => adSet.learningStatus === "LEARNING"),
          bucket: classifyHealthBucket({
            verdict,
            cplTone: tone,
            maxFrequency: aggregate.maxFrequency,
            status: campaign.status,
            totalLead: aggregate.totalLead,
            spend: aggregate.spend,
          }),
        };
      }),
    [campaigns, benchmarkCplIDR],
  );

  const groups = useMemo(() => {
    const byBucket = new Map<HealthBucket, CampaignRow[]>();
    for (const row of rows) {
      const list = byBucket.get(row.bucket);
      if (list) {
        list.push(row);
      } else {
        byBucket.set(row.bucket, [row]);
      }
    }
    if (sortKey !== undefined) {
      for (const list of byBucket.values()) {
        list.sort((a, b) => sortValue(a, sortKey) - sortValue(b, sortKey));
        if (sortDir === "desc") {
          list.reverse();
        }
      }
    }
    return BUCKET_ORDER.map((bucket) => ({ bucket, rows: byBucket.get(bucket) ?? [] })).filter(
      (group) => group.rows.length > 0,
    );
  }, [rows, sortKey, sortDir]);

  if (campaigns.length === 0) {
    return (
      <EmptyState
        title="Tidak ada campaign"
        description="Coba kata kunci lain atau tarik data baru."
      />
    );
  }

  function handleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  let totalSpend = 0;
  let totalLead = 0;
  for (const row of rows) {
    totalSpend += row.aggregate.spend;
    totalLead += row.aggregate.totalLead;
  }

  return (
    <div className={styles.tableWrap}>
      <table data-testid="unified-campaign-table" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Campaign</th>
            <th scope="col">Daily Budget</th>
            <SortableHeader
              label="Spend"
              sortKey="spend"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="Results"
              sortKey="results"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortableHeader
              label="CPA"
              sortKey="cpl"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
            />
            <th scope="col">Impressions</th>
            <th scope="col">Reach</th>
            <th scope="col">CTR</th>
            <th scope="col">CPC</th>
            <th scope="col">CPM</th>
            <SortableHeader
              label="Frequency"
              sortKey="frequency"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
            />
            <th scope="col">Samantha</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.bucket}>
            <tr className={styles.bucketHeaderRow} data-testid={`bucket-header-${group.bucket}`}>
              <td
                colSpan={13}
                className={`${styles.bucketHeaderCell} ${styles[`bucket${capitalize(group.bucket)}`]}`}
              >
                {BUCKET_LABEL[group.bucket]} ({group.rows.length})
              </td>
            </tr>
            {group.rows.map((row) => (
              <CampaignRowView
                key={row.campaign.id}
                row={row}
                isSelected={row.campaign.id === selectedCampaignId}
                benchmarkCplIDR={benchmarkCplIDR}
                onSelect={onSelect}
                onPause={onPause}
              />
            ))}
          </tbody>
        ))}
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

function sortValue(row: CampaignRow, key: SortKey): number {
  switch (key) {
    case "spend":
      return row.aggregate.spend;
    case "cpl":
      return row.cpl ?? -1;
    case "results":
      return row.aggregate.totalLead;
    case "frequency":
      return row.aggregate.maxFrequency;
    default:
      return 0;
  }
}

interface SortableHeaderProps {
  readonly label: string;
  readonly sortKey: SortKey;
  readonly activeKey: SortKey | undefined;
  readonly dir: SortDir;
  readonly onSort: (key: SortKey) => void;
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: SortableHeaderProps): React.ReactElement {
  const isActive = activeKey === sortKey;
  return (
    <th scope="col">
      <button
        type="button"
        data-testid={`sort-${sortKey}`}
        className={styles.sortButton}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className={styles.sortIndicator}>{isActive ? (dir === "desc" ? "▼" : "▲") : ""}</span>
      </button>
    </th>
  );
}

interface CampaignRowViewProps {
  readonly row: CampaignRow;
  readonly isSelected: boolean;
  readonly benchmarkCplIDR: number | null;
  readonly onSelect: (campaignId: string) => void;
  readonly onPause: (campaignId: string) => void;
}

function CampaignRowView({
  row,
  isSelected,
  benchmarkCplIDR,
  onSelect,
  onPause,
}: CampaignRowViewProps): React.ReactElement {
  const { campaign, aggregate, cpl, tone, ctr, cpc, cpm, freqWarning, verdict, isLearning } = row;
  const displayName = splitCampaignDisplayName(campaign.name);
  const cplRatio =
    cpl !== null && benchmarkCplIDR !== null && benchmarkCplIDR > 0 ? cpl / benchmarkCplIDR : null;
  return (
    <tr
      data-testid={`campaign-row-${campaign.id}`}
      className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
      onClick={() => onSelect(campaign.id)}
    >
      <td onClick={(event) => event.stopPropagation()}>
        <StatusToggle status={campaign.status} onPause={() => onPause(campaign.id)} />
      </td>
      <td className={styles.nameCell}>
        <span className={styles.name}>{displayName.name}</span>
        {isLearning ? (
          <span
            data-testid="learning-phase-badge"
            className={styles.learningBadge}
            title="Ada ad set yang masih dalam Learning Phase Meta — evaluasi performa sebenarnya baru akurat setelah keluar dari fase ini."
          >
            🎓 Learning
          </span>
        ) : null}
        {displayName.subtitle !== undefined ? (
          <span className={styles.meta}>{displayName.subtitle}</span>
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
        {cplRatio !== null ? (
          <div className={styles.cplBarTrack} data-testid="cpl-bar-track">
            <div
              className={`${styles.cplBarFill} ${styles[`cplBarFill${capitalize(tone)}`]}`}
              style={{ width: `${Math.min(cplRatio * 100, 150) / 1.5}%` }}
            />
          </div>
        ) : null}
      </td>
      <td data-testid={`impressions-${campaign.id}`}>
        {aggregate.impressions !== null ? formatNumber(aggregate.impressions) : "—"}
      </td>
      <td data-testid={`reach-${campaign.id}`}>
        {aggregate.reach !== null ? formatNumber(aggregate.reach) : "—"}
      </td>
      <td data-testid={`ctr-${campaign.id}`}>{ctr !== null ? formatPercent(ctr) : "—"}</td>
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
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
}

export default UnifiedCampaignTable;
