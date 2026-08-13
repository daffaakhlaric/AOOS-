import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";

export interface ForecastCardData {
  readonly forecastedHotLeads: number;
  readonly forecastedSpend: number;
  readonly probability: number;
  readonly onTrackStatus: "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
}

/**
 * Tamara's projected outcome (spec "components/objective/ForecastCard.tsx"). No `aaos-api`
 * endpoint currently backs `ForecastObjective` (out of AAOS-W4A's 7-endpoint scope — see
 * `README.md`'s "Known limitations"), so this is a presentational component only; wiring a real
 * forecast fetch is follow-up work once that endpoint exists.
 */
export function ForecastCard({ data }: { readonly data: ForecastCardData }): React.ReactElement {
  const tone =
    data.onTrackStatus === "ON_TRACK"
      ? "success"
      : data.onTrackStatus === "AT_RISK"
        ? "warning"
        : "danger";
  return (
    <section
      data-testid="forecast-card"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Proyeksi Tamara</p>
        <StatusBadge label={data.onTrackStatus.replace("_", " ")} tone={tone} />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {formatNumber(data.forecastedHotLeads)} hot leads · {formatIdr(data.forecastedSpend)} ·{" "}
        {formatPercent(data.probability)} probabilitas tercapai
      </p>
    </section>
  );
}
