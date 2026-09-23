import styles from "./AttentionSummary.module.css";

/**
 * Shared header + row primitives for the Needs Attention / Opportunities pair, so the two cards are
 * structurally identical (the user's reference shows them as a matched set: icon square, title,
 * "N items" counter, then uniform rows). Extracted here rather than duplicated in both components.
 */
export function PanelHeader({
  label,
  count,
  countClassName,
}: {
  readonly label: string;
  readonly count?: number;
  /** CSS-module lookups are `string | undefined` under this app's tsconfig, so accept that directly. */
  readonly countClassName: string | undefined;
}): React.ReactElement {
  return (
    <div className={styles.headerRow}>
      <span className={styles.headerIcon} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M12 7.5v5.5" />
          <path d="M12 16.4v.6" />
        </svg>
      </span>
      <p className={styles.panelLabel}>{label}</p>
      {count !== undefined ? <span className={countClassName}>{count} items</span> : null}
    </div>
  );
}

/**
 * One reference-style row: status dot, the real value, a bold label and a muted sub-line.
 *
 * `unavailable` renders a muted em-dash, used ONLY where this codebase genuinely has no real source
 * for the metric — never to hide a number we actually have, and never as a stand-in for a real zero.
 */
export function SummaryRow({
  dotClassName,
  value,
  label,
  note,
  unavailable,
  title,
}: {
  readonly dotClassName: string | undefined;
  readonly value?: string;
  readonly label: string;
  readonly note: string;
  readonly unavailable?: boolean;
  readonly title?: string;
}): React.ReactElement {
  return (
    <div className={styles.row} title={title}>
      <span className={`${styles.dot} ${dotClassName}`} aria-hidden="true" />
      <span
        className={`${styles.rowValue} ${unavailable === true ? styles.rowValueUnavailable : ""}`}
      >
        {unavailable === true ? "—" : value}
      </span>
      <span className={styles.rowLabel}>
        {label}
        <span className={styles.rowNote}>{note}</span>
      </span>
    </div>
  );
}
