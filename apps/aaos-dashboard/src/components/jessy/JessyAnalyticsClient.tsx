"use client";

import { useEffect, useState } from "react";
import { AreaChart, BarChart, LineChart } from "@tremor/react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { LeadsAnalyticsDto } from "@/types/dashboard.types";

import styles from "./JessyAnalyticsClient.module.css";

const PERIOD_OPTIONS = [
  { days: 7, label: "Last 7 days" },
  { days: 14, label: "Last 14 days" },
  { days: 30, label: "Last 30 days" },
] as const;

function formatMinutes(minutes: number | null): string {
  if (minutes === null) {
    return "—";
  }
  if (minutes < 60) {
    return `${minutes.toFixed(1)} mnt`;
  }
  return `${(minutes / 60).toFixed(1)} jam`;
}

/**
 * `/jessy/analytics` — real KPIs computed by `aaos-api`'s new `GET /api/v1/leads/analytics`, from
 * real `@aos/lead-store` data (MENU RESTRUCTURE FINAL). Renders 3 real charts, not the spec
 * mockup's 4: `avgFirstResponseTimeMinutes` is a single tenant-wide aggregate, not a per-agent
 * breakdown (this domain has no per-agent response-time tracking — `messages.sender_name` exists
 * but grouping response gaps by it would need real per-message-pair attribution this endpoint
 * doesn't compute), so it's shown as one KPI cell + a bar next to the overall response time
 * instead of the spec's "donut/gauge chart by agent", which would otherwise fabricate a
 * per-agent split with no real backing data.
 */
export function JessyAnalyticsClient(): React.ReactElement {
  const [days, setDays] = useState(7);
  const [analytics, setAnalytics] = useState<LeadsAnalyticsDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    setAnalytics(undefined);
    setError(undefined);
    fetch(`/api/jessy/analytics?days=${days}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat analytics.");
        }
        return (await res.json()) as LeadsAnalyticsDto;
      })
      .then(setAnalytics)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat analytics.");
      });
  }, [days]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (analytics === undefined) {
    return <LoadingSpinner />;
  }

  const responseTimeData = [
    {
      metric: "Response Time",
      Menit: analytics.avgResponseTimeMinutes ?? 0,
    },
    {
      metric: "First Response",
      Menit: analytics.avgFirstResponseTimeMinutes ?? 0,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.periodRow}>
        <select
          aria-label="Periode"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className={styles.periodSelect}
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.days} value={option.days}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.kpiStrip} data-testid="analytics-kpi-strip">
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>TOTAL CONTACTS</p>
          <p className={styles.kpiValue}>{analytics.totalContacts}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>NEW CONTACTS</p>
          <p className={styles.kpiValue}>{analytics.newContacts}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>ACTIVE</p>
          <p className={styles.kpiValue}>{analytics.active}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>RESPONSE TIME</p>
          <p className={styles.kpiValue}>{formatMinutes(analytics.avgResponseTimeMinutes)}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>FIRST RESP TIME</p>
          <p className={styles.kpiValue}>{formatMinutes(analytics.avgFirstResponseTimeMinutes)}</p>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Total Contacts</p>
          <AreaChart
            data={[...analytics.dailySeries]}
            index="date"
            categories={["totalContacts"]}
            colors={["blue"]}
            className={styles.chart}
          />
        </div>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>New Contacts</p>
          <LineChart
            data={[...analytics.dailySeries]}
            index="date"
            categories={["newContacts"]}
            colors={["emerald"]}
            className={styles.chart}
          />
        </div>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Response Time (menit)</p>
          <BarChart
            data={responseTimeData}
            index="metric"
            categories={["Menit"]}
            colors={["amber"]}
            className={styles.chart}
          />
        </div>
      </div>
    </div>
  );
}
