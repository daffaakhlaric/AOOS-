import styles from "./StatusBadge.module.css";

const VERDICT_TONE: Record<string, string> = {
  FIX: "critical",
  PAUSE: "critical",
  SCALE: "success",
  REFRESH: "warning",
  KEEP: "info",
  REVIEW: "neutral",
};

const VERDICT_LABEL: Record<string, string> = {
  FIX: "Fix",
  PAUSE: "Pause",
  SCALE: "Scale",
  REFRESH: "Refresh",
  KEEP: "Keep",
  REVIEW: "Review",
};

export function VerdictBadge({ verdict }: { readonly verdict: string }): React.ReactElement {
  const tone = VERDICT_TONE[verdict] ?? "neutral";
  return (
    <span className={`${styles.badge} ${styles[`tone_${tone}`]}`} data-testid="verdict-badge">
      {VERDICT_LABEL[verdict] ?? verdict}
    </span>
  );
}

export function StatusDot({
  colorVar,
  label,
}: {
  readonly colorVar: string;
  readonly label?: string;
}): React.ReactElement {
  return (
    <span className={styles.dotRow}>
      <span className={styles.dot} style={{ background: `var(${colorVar})` }} aria-hidden="true" />
      {label !== undefined ? <span className={styles.dotLabel}>{label}</span> : null}
    </span>
  );
}
