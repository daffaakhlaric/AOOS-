import { MetricCard } from "@/components/ui/MetricCard";
import { formatIdrCompact, formatNumber } from "@/lib/formatters";

import styles from "./SummaryCards.module.css";

export interface SummaryCardsData {
  /** Meta Ads-sourced — undefined when the caller has none to show without hitting Meta's API (see `DashboardClient.tsx`'s docstring). Omitted from the card list, not shown as 0/blank, when undefined. */
  readonly spend?: number;
  readonly spendChangePercent?: number;
  /** Meta Ads-sourced — same undefined-means-omitted contract as `spend` above. */
  readonly d3Leads?: number;
  readonly d3ChangePercent?: number;
  readonly hotLeads: number;
  readonly hotLeadsChangePercent: number;
  readonly closings: number;
  readonly closingsChangePercent: number;
}

/**
 * The "Overview Bulan Ini" KPI cards (spec "dashboard/page.tsx" mockup): Belanja, D3 Lead, Hot
 * Lead, Closing. Real bug fix: `DashboardClient` no longer fetches Meta Ads data automatically
 * (it was auto-hitting Meta's rate limit on every dashboard visit), so `spend`/`d3Leads` are now
 * optional — Belanja/D3 Lead only render when a caller actually has that data to show (e.g. a
 * future page that already has fresh Meta data on hand), never as a fetched-then-shown value here.
 */
export function SummaryCards({ data }: { readonly data: SummaryCardsData }): React.ReactElement {
  return (
    <div className={styles.grid}>
      {data.spend !== undefined ? (
        <MetricCard
          label="Belanja"
          value={formatIdrCompact(data.spend)}
          changePercent={data.spendChangePercent ?? 0}
        />
      ) : null}
      {data.d3Leads !== undefined ? (
        <MetricCard
          label="D3 Lead"
          value={formatNumber(data.d3Leads)}
          changePercent={data.d3ChangePercent ?? 0}
        />
      ) : null}
      <MetricCard
        label="Hot Lead"
        value={formatNumber(data.hotLeads)}
        changePercent={data.hotLeadsChangePercent}
      />
      <MetricCard
        label="Closing"
        value={formatNumber(data.closings)}
        changePercent={data.closingsChangePercent}
      />
    </div>
  );
}
