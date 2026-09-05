import styles from "./MetricCard.module.css";

/**
 * Shared small metric-card primitive (Sprint 5 Prompt 11/12 dispatch): "label kecil abu, angka
 * besar, delta % (hijau naik baik, merah untuk metrik yang harusnya turun seperti cost — logic
 * terbalik), sparkline mini di bawah angka". Genuinely reused by BOTH `CampaignDetailDrawer.tsx`
 * (Prompt 11 Blok 2) and the heatmap asset-detail view (Prompt 12's read-only modal) rather than
 * duplicated — see this module's own test for a real assertion of that reuse.
 *
 * Honest degrade: `delta` and `sparkline` are optional. Neither the already-loaded campaign
 * snapshot (`AdMetricsDto`) nor the real `AssetDetailResponseDto`/`HeatmapCellDto` payloads carry a
 * historical time series or a previous-period comparison value anywhere in this codebase today —
 * fabricating either would violate this dispatch's own "never fabricate metrics" discipline. When
 * omitted, this card simply renders label + value with no delta pill / no sparkline, rather than
 * inventing placeholder motion.
 */
export interface MetricCardDelta {
  readonly percent: number;
  /** Whether a HIGHER raw value is the desirable direction for this metric (e.g. spend/CPL are
   * `false` — "logic terbalik" per the spec: an increase there renders red, a decrease green). */
  readonly higherIsBetter: boolean;
}

export interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly delta?: MetricCardDelta;
  /** 7-14 raw data points, oldest first. Rendered as a small axis-less sparkline, height 24px. */
  readonly sparkline?: readonly number[];
  readonly testId?: string;
}

function sparklinePath(points: readonly number[], width: number, height: number): string {
  if (points.length < 2) {
    return "";
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;
  const stepX = width / (points.length - 1);
  return points
    .map((point, index) => {
      const x = index * stepX;
      const y = range === 0 ? height / 2 : height - ((point - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const SPARKLINE_WIDTH = 96;
const SPARKLINE_HEIGHT = 24;

export function MetricCard({
  label,
  value,
  delta,
  sparkline,
  testId,
}: MetricCardProps): React.ReactElement {
  const deltaGood = delta !== undefined && delta.percent >= 0 === delta.higherIsBetter;
  return (
    <div className={styles.card} data-testid={testId ?? "metric-card"}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {delta !== undefined ? (
        <span
          className={`${styles.delta} ${deltaGood ? styles.deltaGood : styles.deltaBad}`}
          data-testid="metric-card-delta"
        >
          {delta.percent >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta.percent))}%
        </span>
      ) : null}
      {sparkline !== undefined && sparkline.length >= 2 ? (
        <svg
          className={styles.sparkline}
          data-testid="metric-card-sparkline"
          width={SPARKLINE_WIDTH}
          height={SPARKLINE_HEIGHT}
          viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
          aria-hidden="true"
        >
          <path
            d={sparklinePath(sparkline, SPARKLINE_WIDTH, SPARKLINE_HEIGHT)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          />
        </svg>
      ) : null}
    </div>
  );
}

export default MetricCard;
