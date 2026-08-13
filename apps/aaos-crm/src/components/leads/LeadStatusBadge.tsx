export type StatusTone = "success" | "warning" | "danger" | "neutral";

const STATUS_LABEL: Readonly<Record<string, string>> = {
  HOT: "HOT",
  WARM: "WARM",
  COLD: "COLD",
  ASSIGNED: "ASSIGNED",
  CLOSED: "CLOSED",
  NEW: "NEW",
};

const STATUS_TONE: Readonly<Record<string, StatusTone>> = {
  HOT: "danger",
  WARM: "warning",
  COLD: "neutral",
  ASSIGNED: "success",
  CLOSED: "neutral",
  NEW: "neutral",
};

const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  success: "bg-brand-success/10 text-brand-success border-brand-success/30",
  warning: "bg-brand-warning/10 text-brand-warning border-brand-warning/30",
  danger: "bg-brand-danger/10 text-brand-danger border-brand-danger/30",
  neutral: "bg-ink-muted/10 text-ink-muted border-ink-muted/30",
};

export interface LeadStatusBadgeProps {
  readonly status: string;
}

/** HOT/WARM/COLD/ASSIGNED/CLOSED pill (spec "components/leads/LeadStatusBadge.tsx"). HOT is always red per the spec's own readiness checklist. */
export function LeadStatusBadge({ status }: LeadStatusBadgeProps): React.ReactElement {
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = STATUS_LABEL[status] ?? status;
  return (
    <span
      data-testid="lead-status-badge"
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
