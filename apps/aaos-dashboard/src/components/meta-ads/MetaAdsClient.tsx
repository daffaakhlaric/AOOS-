"use client";

import { useEffect, useState } from "react";

import { CampaignTable } from "@/components/meta-ads/CampaignTable";
import { DateRangeSelector } from "@/components/meta-ads/DateRangeSelector";
import { MetricsSummaryBar } from "@/components/meta-ads/MetricsSummaryBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { AdAccountSummaryDto, CampaignAdDto } from "@/types/dashboard.types";

/** Fetches `/api/campaigns` and renders the MAAO2-style ad table (spec "meta-ads/page.tsx"). */
export function MetaAdsClient(): React.ReactElement {
  const [datePreset, setDatePreset] = useState("last_30d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<AdAccountSummaryDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/campaigns?datePreset=${encodeURIComponent(datePreset)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat data iklan.");
        }
        return (await res.json()) as AdAccountSummaryDto;
      })
      .then((body) => {
        if (!cancelled) {
          setData(body);
          setError(undefined);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat data iklan.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [datePreset, refreshKey]);

  /** Executes `ad`'s current verdict via `/api/verdicts`, which proxies the real, pre-existing `aaos-api` `POST /api/v1/verdicts` endpoint. Bumps `refreshKey` afterward so the table re-fetches and reflects the ad's new (paused/scaled/...) status. */
  function handleExecute(ad: CampaignAdDto): void {
    void fetch("/api/verdicts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ verdict: ad.verdict, targetId: ad.id, targetType: "ad" }),
    })
      .then(() => setRefreshKey((current) => current + 1))
      .catch(() => undefined);
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">📊 Data Iklan</h2>
        <DateRangeSelector value={datePreset} onChange={setDatePreset} />
      </div>
      {loading ? <LoadingSpinner /> : null}
      {error !== undefined ? <ErrorCard message={error} /> : null}
      {!loading && error === undefined && data !== undefined ? (
        <>
          <MetricsSummaryBar totals={data.totals} />
          <CampaignTable ads={data.ads} onExecute={handleExecute} />
        </>
      ) : null}
    </div>
  );
}
