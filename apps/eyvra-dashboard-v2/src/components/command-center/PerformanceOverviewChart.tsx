"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@tremor/react";

import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { formatDateId, formatDateTimeIdWib } from "@/lib/formatters";
import type {
  OverviewTimeseriesPointDto,
  OverviewTimeseriesResponseDto,
} from "@/types/dashboard.types";

import styles from "./PerformanceOverviewChart.module.css";

type Metric = "spend" | "leads" | "cpl";

const METRIC_LABEL: Record<Metric, string> = {
  spend: "Spend",
  leads: "Raw Leads",
  cpl: "CPL",
};

export function PerformanceOverviewChart({
  onPointsLoaded,
}: {
  readonly onPointsLoaded?: (points: readonly OverviewTimeseriesPointDto[]) => void;
}): React.ReactElement {
  const [points, setPoints] = useState<readonly OverviewTimeseriesPointDto[] | undefined>(
    undefined,
  );
  const [failed, setFailed] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | undefined>(undefined);
  const [metric, setMetric] = useState<Metric>("spend");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetch("/api/overview/timeseries?days=30")
      .then((res) => (res.ok ? (res.json() as Promise<OverviewTimeseriesResponseDto>) : null))
      .then((body) => {
        if (!cancelled) {
          if (body === null) {
            setFailed(true);
          } else {
            setPoints(body.points);
            setLastSuccessAt(new Date().toISOString());
            onPointsLoaded?.(body.points);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPointsLoaded is a stable setState-wrapping callback from the parent; `attempt` is the real retry trigger.
  }, [attempt]);

  if (failed) {
    return (
      <div data-testid="cc-performance-overview-error">
        <p className={styles.errorTitle}>Performance temporarily unavailable</p>
        {lastSuccessAt !== undefined ? (
          <p className={styles.errorMeta}>Last data: {formatDateTimeIdWib(lastSuccessAt)}</p>
        ) : null}
        <button
          type="button"
          className={styles.retryButton}
          onClick={() => setAttempt((n) => n + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (points === undefined) {
    return <LoadingState processLabel="Memuat data performa 30 hari terakhir..." />;
  }

  if (points.length < 2) {
    return (
      <EmptyState
        title="Belum cukup data historis"
        description="Grafik akan terisi seiring waktu berjalan — menunggu snapshot harian yang tersedia."
      />
    );
  }

  const chartData = points.map((point) => ({
    tanggal: formatDateId(point.date),
    Spend: point.totalSpend,
    "Raw Leads": point.totalLeads,
    CPL: point.totalLeads > 0 ? Math.round(point.totalSpend / point.totalLeads) : null,
  }));
  const categoryByMetric: Record<Metric, string> = {
    spend: "Spend",
    leads: "Raw Leads",
    cpl: "CPL",
  };
  const colorByMetric: Record<Metric, "cyan" | "emerald" | "amber"> = {
    spend: "cyan",
    leads: "emerald",
    cpl: "amber",
  };

  return (
    <div data-testid="cc-performance-overview">
      <div className={styles.selector} role="tablist" aria-label="Pilih metric performa">
        {(Object.keys(METRIC_LABEL) as Metric[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={metric === key}
            className={`${styles.selectorButton} ${metric === key ? styles.selectorButtonActive : ""}`}
            onClick={() => setMetric(key)}
          >
            {METRIC_LABEL[key]}
          </button>
        ))}
      </div>
      <LineChart
        data={chartData}
        index="tanggal"
        categories={[categoryByMetric[metric]]}
        colors={[colorByMetric[metric]]}
        showAnimation
        showLegend={false}
        /* Was the Tailwind `h-20` (80px) — far too short for a real 12-day trend (user-reported
           "performance review kecil bgt"). A CSS Module class instead, matching this app's own
           styling convention, and sized to the taller Row-C card. */
        className={styles.chart}
      />
    </div>
  );
}
