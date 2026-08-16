import styles from "./MetricCard.module.css";

export interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly changePercent?: number;
}

/** A single KPI card (spec "components/ui/MetricCard.tsx" — the 4 "Overview Bulan Ini" cards render through this; TOTAL UI REBUILD spec: "=== KPI STRIP ===" cell typography — 11px uppercase tracking-wide label, 26px/700 value, 11px subvalue). */
export function MetricCard({ label, value, changePercent }: MetricCardProps): React.ReactElement {
  const isPositive = changePercent !== undefined && changePercent >= 0;
  return (
    <div data-testid="metric-card" className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {changePercent !== undefined ? (
        <p
          data-testid="metric-card-change"
          data-direction={isPositive ? "positive" : "negative"}
          className={`${styles.change} ${isPositive ? styles.positive : styles.negative}`}
        >
          {isPositive ? "↑" : "↓"} {Math.abs(changePercent)}%
        </p>
      ) : null}
    </div>
  );
}
