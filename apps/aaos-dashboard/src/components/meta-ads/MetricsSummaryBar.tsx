import { formatIdrCompact, formatNumber } from "@/lib/formatters";
import type { AdMetricsDto } from "@/types/dashboard.types";

export interface MetricsSummaryBarProps {
  readonly totals: AdMetricsDto;
  /** Number of campaigns/ads in the current pull (spec "meta-ads/page.tsx" MAAO2 redesign summary bar: "KAMPANYE · IKLAN" columns). Optional so existing callers passing just `totals` keep compiling. */
  readonly campaignCount?: number;
  readonly adCount?: number;
}

/** Belanja · Chat · D2 · D3 · D5 · Form · Total Lead (· Kampanye · Iklan, when counts are given) summary bar (spec "components/meta-ads/MetricsSummaryBar.tsx"). */
export function MetricsSummaryBar({
  totals,
  campaignCount,
  adCount,
}: MetricsSummaryBarProps): React.ReactElement {
  const items: Array<readonly [string, string]> = [
    ["Belanja", formatIdrCompact(totals.spend)],
    ["Chat", formatNumber(totals.conversations)],
    ["D2", formatNumber(totals.d2)],
    ["D3", formatNumber(totals.d3)],
    ["D5", formatNumber(totals.d5)],
    ["Form", formatNumber(totals.leadForm)],
    ["Total Lead", formatNumber(totals.totalLead)],
  ];
  if (campaignCount !== undefined) {
    items.push(["Kampanye", formatNumber(campaignCount)]);
  }
  if (adCount !== undefined) {
    items.push(["Iklan", formatNumber(adCount)]);
  }
  return (
    <div
      data-testid="metrics-summary-bar"
      className="grid grid-cols-3 divide-y divide-hairline-card rounded-kpi border border-hairline-card bg-surface-card sm:grid-cols-7 sm:divide-x sm:divide-y-0"
    >
      {items.map(([label, value]) => (
        <div key={label} className="flex-1 px-6 py-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}
