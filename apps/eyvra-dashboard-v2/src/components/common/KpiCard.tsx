import { Sparkline, type SparklineTone } from "./Sparkline";

import styles from "./KpiCard.module.css";

export type KpiTone = "neutral" | "up" | "down";

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  series,
  unavailable,
  unavailableReason,
  testId,
}: {
  readonly label: string;
  readonly value?: string;
  readonly delta?: string;
  readonly deltaTone?: KpiTone;
  /**
   * Real historical series for this metric's sparkline (reference design shows one per KPI card).
   * Omitted entirely for metrics with no real daily history — `Sparkline` itself also renders
   * nothing below 2 real points, so a tenant with a single snapshot day never gets a fake trend.
   */
  readonly series?: readonly number[];
  readonly unavailable?: boolean;
  readonly unavailableReason?: string;
  readonly testId?: string;
}): React.ReactElement {
  return (
    <div className={styles.cell} data-testid={testId}>
      <p className={styles.label}>{label}</p>
      {unavailable === true ? (
        <>
          <p className={styles.unavailableValue}>—</p>
          <p className={styles.unavailableReason}>{unavailableReason ?? "Belum tersedia"}</p>
        </>
      ) : (
        <>
          <p className={styles.value}>{value}</p>
          {delta !== undefined ? (
            <p className={`${styles.delta} ${styles[`delta_${deltaTone}`]}`}>{delta}</p>
          ) : null}
          {series !== undefined ? (
            <Sparkline
              points={series}
              tone={deltaTone as SparklineTone}
              ariaLabel={`Tren ${label}`}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
