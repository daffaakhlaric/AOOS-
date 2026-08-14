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
      className="grid grid-cols-3 gap-3 rounded-card border border-hairline bg-surface-card p-4 shadow-card sm:grid-cols-7"
    >
      {items.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs text-ink-muted">{label}</p>
          <p className="text-sm font-semibold text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}
