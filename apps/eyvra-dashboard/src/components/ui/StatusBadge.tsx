import styles from "./StatusBadge.module.css";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export interface StatusBadgeProps {
  readonly label: string;
  readonly tone: StatusTone;
}

const TONE_CLASS: Readonly<Record<StatusTone, keyof typeof styles>> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
};

/** A pill-shaped colored status badge (spec "components/ui/StatusBadge.tsx") — the shared primitive sales-status/branch-active badges render through. */
export function StatusBadge({ label, tone }: StatusBadgeProps): React.ReactElement {
  return (
    <span
      data-testid="status-badge"
      data-tone={tone}
      className={`${styles.badge} ${styles[TONE_CLASS[tone]]}`}
    >
      {label}
    </span>
  );
}
