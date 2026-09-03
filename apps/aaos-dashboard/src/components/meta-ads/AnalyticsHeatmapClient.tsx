"use client";

import { useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { friendlyApiErrorMessage } from "@/lib/apiErrorMessage";
import type { HeatmapResponseDto } from "@/types/dashboard.types";

import { HeatmapGrid } from "./HeatmapGrid";
import styles from "./AnalyticsHeatmapClient.module.css";

const DEFAULT_DATE_PRESET = "last_30d";

/**
 * `/meta-ads/analytics/heatmap` page body (AAOS Analytics Platform Phase 3). Auto-fetches
 * `/api/analytics/heatmap` on mount (unlike `useCampaignsSnapshot`'s deliberate manual-fetch-only
 * house style for the shared campaigns snapshot — this page has its own dedicated endpoint with
 * its own 15-minute server-side cache, so a plain auto-fetch-on-mount is the simplest honest
 * behavior for a standalone analytics report page, not a second convention competing with the
 * shared snapshot).
 */
export function AnalyticsHeatmapClient(): React.ReactElement {
  const [data, setData] = useState<HeatmapResponseDto | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(undefined);
      try {
        const params = new URLSearchParams({ datePreset: DEFAULT_DATE_PRESET });
        const res = await fetch(`/api/analytics/heatmap?${params.toString()}`);
        if (!res.ok) {
          throw new Error(
            await friendlyApiErrorMessage(res, "Gagal memuat heatmap audiens × kreatif."),
          );
        }
        const body = (await res.json()) as HeatmapResponseDto;
        if (!cancelled) {
          setData(body);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Gagal memuat heatmap audiens × kreatif.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }
  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <ErrorCard message="Tidak ada data heatmap yang diterima." />;
  }

  return (
    <div className={styles.wrap}>
      <HeatmapGrid heatmap={data} />
    </div>
  );
}
