import styles from "./Sparkline.module.css";

export type SparklineTone = "up" | "down" | "neutral";

const TONE_STROKE: Record<SparklineTone, string> = {
  up: "var(--success)",
  down: "var(--critical)",
  neutral: "var(--brand)",
};

const VIEW_W = 100;
const VIEW_H = 28;

/**
 * Tiny inline-SVG sparkline for a KPI card — no charting dependency (this app already renders its
 * one real chart with `@tremor/react`; pulling Tremor into a 28px-tall KPI decoration would be far
 * heavier than the ~20 lines of path math below, and this shape needs no axes/tooltips/legend).
 *
 * Renders NOTHING (returns `null`) below 2 real points: a single point is not a trend, and drawing a
 * flat line for it would imply real history this tenant does not have yet. Same honest-degrade rule
 * `PerformanceOverviewChart` already applies to the full-size chart.
 *
 * `preserveAspectRatio="none"` lets the fixed 100x28 viewBox stretch to whatever real width the
 * card's grid track ends up being, so the path math stays independent of the card's rendered size.
 */
export function Sparkline({
  points,
  tone = "neutral",
  ariaLabel,
}: {
  readonly points: readonly number[];
  readonly tone?: SparklineTone;
  readonly ariaLabel?: string;
}): React.ReactElement | null {
  if (points.length < 2) {
    return null;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  // A genuinely flat real series (max === min) would divide by zero — draw it on the centre line
  // rather than dropping it, since "flat" is itself a real, true shape for this data.
  const span = max - min === 0 ? 1 : max - min;
  const stepX = VIEW_W / (points.length - 1);

  const coords = points.map((value, index) => {
    const x = index * stepX;
    const y = VIEW_H - ((value - min) / span) * VIEW_H;
    return { x, y: max - min === 0 ? VIEW_H / 2 : y };
  });

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`;
  const stroke = TONE_STROKE[tone];
  const gradientId = `spark-${tone}`;

  return (
    <svg
      className={styles.spark}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      role={ariaLabel !== undefined ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel === undefined}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
