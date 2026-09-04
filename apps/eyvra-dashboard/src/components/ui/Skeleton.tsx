import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  /** CSS height, e.g. "16px" or "100%". Defaults to a single text-line height. */
  readonly height?: string;
  /** CSS width, e.g. "60%" or "120px". Defaults to full width of its container. */
  readonly width?: string;
  /** Extra class name so callers can compose (e.g. matching a specific KPI cell's shape). */
  readonly className?: string;
}

/**
 * A single shimmering placeholder block (spec "GLOBAL: LOADING STATES" — "Skeleton loading (bukan
 * spinner)... Gunakan skeleton shimmer untuk: KPI strip cells, Table rows, Campaign cards"). This
 * is the primitive block; callers compose several of these (or `SkeletonRows`) into whatever shape
 * the loading page needs. `height`/`width` are genuinely dynamic per-call-site values (a KPI cell
 * skeleton is a different size than a table-row skeleton) — the one place this app's "no inline
 * `style={{}}`" rule allows an inline style, matching the same exception already used elsewhere
 * (e.g. progress-bar fills).
 */
export function Skeleton({
  height = "14px",
  width = "100%",
  className,
}: SkeletonProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-testid="skeleton"
      className={`${styles.skeleton} ${className ?? ""}`}
      style={{ height, width }}
    />
  );
}

/** A stack of `count` skeleton lines, e.g. for a loading table body. */
export function SkeletonRows({
  count,
  height = "14px",
}: {
  readonly count: number;
  readonly height?: string;
}): React.ReactElement {
  return (
    <div className={styles.rows}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={`skeleton-row-${i}`} height={height} />
      ))}
    </div>
  );
}
