import { KpiCard } from "@/components/common/KpiCard";
import { computeRealDelta } from "@/components/common/MetricDelta";
import { formatIdrCompact, formatNumber } from "@/lib/formatters";
import type { OverviewResponseDto, OverviewTimeseriesPointDto } from "@/types/dashboard.types";

import styles from "./KpiStrip.module.css";

export function KpiStrip({
  overview,
  timeseriesPoints,
}: {
  readonly overview: OverviewResponseDto;
  readonly timeseriesPoints?: readonly OverviewTimeseriesPointDto[];
}): React.ReactElement {
  const totalSpend = overview.campaigns?.totalSpend;
  const totalLeads = overview.campaigns?.campaigns.reduce(
    (sum, campaign) =>
      sum +
      campaign.adSets.reduce(
        (adSetSum, adSet) =>
          adSetSum + adSet.ads.reduce((adSum, ad) => adSum + ad.metrics.totalLead, 0),
        0,
      ),
    0,
  );
  const hotLeads = overview.leads?.hot;
  const cpl =
    totalSpend !== undefined && totalLeads !== undefined && totalLeads > 0
      ? totalSpend / totalLeads
      : undefined;

  const spendDelta =
    timeseriesPoints !== undefined
      ? computeRealDelta(
          timeseriesPoints.map((p) => p.totalSpend),
          false,
        )
      : undefined;
  const leadsDelta =
    timeseriesPoints !== undefined
      ? computeRealDelta(
          timeseriesPoints.map((p) => p.totalLeads),
          true,
        )
      : undefined;

  /**
   * Real sparkline series, straight from the real `overview/timeseries` daily snapshots — the same
   * already-fetched array the deltas above are computed from, never a second source and never
   * synthesised. Only the 3 metrics that genuinely HAVE a real daily history get one:
   *  - Spend / Raw Leads: real stored columns on each snapshot row.
   *  - CPL: derived per-day from those same two real columns (`spend / leads`), skipping days with
   *    zero real leads (CPL is undefined on those days, not zero) — the series is dropped entirely
   *    unless at least 2 real days survive that filter, so a sparse tenant gets no line rather than
   *    a misleading one.
   * Hot Leads / CPQL / Booking deliberately get NO sparkline: no real per-day history exists for
   * them anywhere in this codebase (hot/warm/cold are point-in-time counts; CPQL/booking have no
   * real CRM source at all).
   */
  const spendSeries = timeseriesPoints?.map((p) => p.totalSpend);
  const leadsSeries = timeseriesPoints?.map((p) => p.totalLeads);
  const cplSeriesRaw = timeseriesPoints
    ?.filter((p) => p.totalLeads > 0)
    .map((p) => p.totalSpend / p.totalLeads);
  const cplSeries =
    cplSeriesRaw !== undefined && cplSeriesRaw.length >= 2 ? cplSeriesRaw : undefined;

  return (
    <div className={styles.strip} data-testid="cc-kpi-strip">
      <KpiCard
        label="Spend"
        value={totalSpend !== undefined ? formatIdrCompact(totalSpend) : undefined}
        unavailable={totalSpend === undefined}
        unavailableReason="Data spend belum tersedia"
        delta={spendDelta?.label}
        deltaTone={spendDelta?.tone}
        series={spendSeries}
        testId="cc-kpi-spend"
      />
      <KpiCard
        label="Raw Leads"
        value={totalLeads !== undefined ? formatNumber(totalLeads) : undefined}
        unavailable={totalLeads === undefined}
        unavailableReason="Data leads belum tersedia"
        delta={leadsDelta?.label}
        deltaTone={leadsDelta?.tone}
        series={leadsSeries}
        testId="cc-kpi-raw-leads"
      />
      <KpiCard
        label="Hot Leads"
        value={hotLeads !== undefined ? formatNumber(hotLeads) : undefined}
        unavailable={hotLeads === undefined}
        unavailableReason="Data leads belum tersedia"
        testId="cc-kpi-hot-leads"
      />
      <KpiCard
        label="CPL"
        value={cpl !== undefined ? formatIdrCompact(cpl) : undefined}
        unavailable={cpl === undefined}
        unavailableReason="Belum ada leads untuk dihitung"
        series={cplSeries}
        testId="cc-kpi-cpl"
      />
      <KpiCard
        label="CPQL"
        unavailable
        unavailableReason="Qualified data unavailable"
        testId="cc-kpi-cpql"
      />
      <KpiCard
        label="Booking"
        unavailable
        unavailableReason="Booking data unavailable"
        testId="cc-kpi-booking"
      />
    </div>
  );
}
