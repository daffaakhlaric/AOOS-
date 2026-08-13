export interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly changePercent?: number;
}

/** A single KPI card (spec "components/ui/MetricCard.tsx" — the 4 "Overview Bulan Ini" cards render through this). */
export function MetricCard({ label, value, changePercent }: MetricCardProps): React.ReactElement {
  const isPositive = changePercent !== undefined && changePercent >= 0;
  return (
    <div
      data-testid="metric-card"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {changePercent !== undefined ? (
        <p
          className={`mt-1 text-xs font-medium ${isPositive ? "text-brand-success" : "text-brand-danger"}`}
        >
          {isPositive ? "↑" : "↓"} {Math.abs(changePercent)}%
        </p>
      ) : null}
    </div>
  );
}
