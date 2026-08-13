import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatNumber, formatPercent } from "@/lib/formatters";

export type OnTrackStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";

export interface ObjectiveProgressData {
  readonly targetHotLeads: number;
  readonly currentHotLeads: number;
  readonly onTrackStatus: OnTrackStatus;
  readonly forecastedHotLeads?: number;
}

const STATUS_LABEL: Readonly<Record<OnTrackStatus, string>> = {
  ON_TRACK: "ON TRACK",
  AT_RISK: "AT RISK",
  OFF_TRACK: "OFF TRACK",
};

const STATUS_TONE: Readonly<Record<OnTrackStatus, "success" | "warning" | "danger">> = {
  ON_TRACK: "success",
  AT_RISK: "warning",
  OFF_TRACK: "danger",
};

/** Progress bar + on-track status (spec "dashboard/page.tsx" mockup: "Target: 50 hot leads / Progress: 47/50 (94%)"). */
export function ObjectiveProgress({
  data,
}: {
  readonly data: ObjectiveProgressData;
}): React.ReactElement {
  const fraction =
    data.targetHotLeads > 0 ? Math.min(1, data.currentHotLeads / data.targetHotLeads) : 0;
  return (
    <section
      data-testid="objective-progress"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          Target: {formatNumber(data.targetHotLeads)} hot leads · Progress:{" "}
          {formatNumber(data.currentHotLeads)}/{formatNumber(data.targetHotLeads)} (
          {formatPercent(fraction)})
        </p>
        <StatusBadge
          label={STATUS_LABEL[data.onTrackStatus]}
          tone={STATUS_TONE[data.onTrackStatus]}
        />
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-page"
      >
        <div
          data-testid="objective-progress-bar"
          className="h-full rounded-full bg-brand-primary"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
      {data.forecastedHotLeads !== undefined ? (
        <p className="mt-2 text-xs text-ink-muted">
          Proyeksi akhir bulan: {formatNumber(data.forecastedHotLeads)} leads
        </p>
      ) : null}
    </section>
  );
}
