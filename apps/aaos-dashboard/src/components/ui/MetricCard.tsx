export interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly changePercent?: number;
}

/** A single KPI card (spec "components/ui/MetricCard.tsx" — the 4 "Overview Bulan Ini" cards render through this; UI-overhaul pass: "=== KPI SUMMARY BAR ===" cell typography — 11px uppercase tracking-wide label, 24px/700 value, 11px subtext). */
export function MetricCard({ label, value, changePercent }: MetricCardProps): React.ReactElement {
  const isPositive = changePercent !== undefined && changePercent >= 0;
  return (
    <div
      data-testid="metric-card"
      className="card-hover-lift rounded-card border border-hairline-card bg-surface-card p-4 shadow-card"
    >
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {changePercent !== undefined ? (
        <p
          className={`mt-1 text-[11px] font-medium ${isPositive ? "text-brand-success" : "text-brand-danger"}`}
        >
          {isPositive ? "↑" : "↓"} {Math.abs(changePercent)}%
        </p>
      ) : null}
    </div>
  );
}
