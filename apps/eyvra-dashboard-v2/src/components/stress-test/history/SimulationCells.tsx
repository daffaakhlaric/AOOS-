import {
  CONFIDENCE_LEVEL_LABELS,
  CONFIDENCE_TOOLTIP,
  type SimulationRunListItem,
} from "@/lib/stress-test-history";
import styles from "./history.module.css";

/** Readiness from the real result bucket only; "—" when the run has no evaluated bucket. */
export function SimulationReadinessBadge({
  item,
}: {
  readonly item: SimulationRunListItem;
}): React.ReactElement {
  if (item.bucketLabel === undefined || item.bucketTone === undefined) {
    return (
      <span className={styles.dash} title="Belum ada hasil evaluasi" data-testid="run-readiness">
        —
      </span>
    );
  }
  return (
    <span
      className={`${styles.badge} ${styles[`tone_${item.bucketTone}`] ?? ""}`}
      data-testid="run-readiness"
    >
      {item.bucketLabel}
    </span>
  );
}

/** "42/100" + mini bar; "—" (never 0) when the result has no overall score. */
export function SimulationScoreCell({
  item,
}: {
  readonly item: SimulationRunListItem;
}): React.ReactElement {
  if (item.score === undefined) {
    return (
      <span className={styles.dash} data-testid="run-score">
        —
      </span>
    );
  }
  const pct = Math.max(0, Math.min(100, item.score));
  return (
    <span className={styles.score} data-testid="run-score">
      <span>
        <strong>{item.score}</strong>/100
      </span>
      <span
        className={styles.bar}
        role="progressbar"
        aria-label="Creative Readiness Score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span
          className={`${styles.barFill} ${item.bucketTone !== undefined ? (styles[`barFill_${item.bucketTone}`] ?? "") : ""}`}
          style={{ width: `${String(pct)}%`, display: "block" }}
        />
      </span>
    </span>
  );
}

export function SimulationConfidenceCell({
  item,
}: {
  readonly item: SimulationRunListItem;
}): React.ReactElement {
  if (item.confidence === undefined || item.confidenceLevel === undefined) {
    return (
      <span className={styles.dash} data-testid="run-confidence">
        —
      </span>
    );
  }
  return (
    <span title={CONFIDENCE_TOOLTIP} data-testid="run-confidence">
      <strong>{item.confidence}%</strong>
      <span className={`${styles.sub} ${styles[`level_${item.confidenceLevel}`] ?? ""}`}>
        {CONFIDENCE_LEVEL_LABELS[item.confidenceLevel]}
      </span>
    </span>
  );
}
