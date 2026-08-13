export type StatusTone = "success" | "warning" | "danger" | "neutral";

export interface StatusBadgeProps {
  readonly label: string;
  readonly tone: StatusTone;
}

const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  success: "bg-brand-success/10 text-brand-success border-brand-success/30",
  warning: "bg-brand-warning/10 text-brand-warning border-brand-warning/30",
  danger: "bg-brand-danger/10 text-brand-danger border-brand-danger/30",
  neutral: "bg-ink-muted/10 text-ink-muted border-ink-muted/30",
};

/** A pill-shaped colored status badge (spec "components/ui/StatusBadge.tsx") — the shared primitive `VerdictBadge`/sales-status/branch-active badges all render through. */
export function StatusBadge({ label, tone }: StatusBadgeProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
