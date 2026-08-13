import { formatIdrCompact, formatNumber } from "@/lib/formatters";
import type { AdMetricsDto } from "@/types/dashboard.types";

/** Belanja · Chat · D2 · D3 · D5 · Form · Total Lead summary bar (spec "components/meta-ads/MetricsSummaryBar.tsx"). */
export function MetricsSummaryBar({
  totals,
}: {
  readonly totals: AdMetricsDto;
}): React.ReactElement {
  const items: ReadonlyArray<readonly [string, string]> = [
    ["Belanja", formatIdrCompact(totals.spend)],
    ["Chat", formatNumber(totals.conversations)],
    ["D2", formatNumber(totals.d2)],
    ["D3", formatNumber(totals.d3)],
    ["D5", formatNumber(totals.d5)],
    ["Form", formatNumber(totals.leadForm)],
    ["Total Lead", formatNumber(totals.totalLead)],
  ];
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
