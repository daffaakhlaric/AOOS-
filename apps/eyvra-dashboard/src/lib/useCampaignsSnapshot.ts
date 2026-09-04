"use client";

import { useEffect, useRef, useState } from "react";

import { friendlyApiErrorMessage } from "@/lib/apiErrorMessage";
import {
  CAMPAIGNS_CACHE_UPDATED_EVENT,
  readCampaignsCache,
  writeCampaignsCache,
  type CampaignsCacheEntry,
} from "@/lib/campaignsCache";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

const DEFAULT_DATE_PRESET = "last_30d";

export interface CampaignsSnapshotState {
  /** The current snapshot — from `localStorage` on mount, or from the last successful `pull()`. `undefined` when nothing has ever been pulled. */
  readonly data: AdAccountSummaryDto | undefined;
  readonly fetchedAt: number | undefined;
  readonly period: string | undefined;
  readonly loading: boolean;
  readonly error: string | undefined;
  /** Force-pulls a fresh snapshot from `/api/campaigns` (bypassing both this cache and its 5-minute server-side cache), writes it to the shared `campaignsCache`, and updates this hook's state. */
  readonly pull: (datePreset?: string) => Promise<void>;
}

/**
 * Shared "read the cached campaigns snapshot, offer a manual pull" hook for the 4 new Samantha
 * pages (`/meta-ads/audit`, `/analisa`, `/strategi`, `/simulasi`) — coordinator note #7: all of
 * `/meta-ads`'s pages read the SAME `src/lib/campaignsCache.ts`-backed snapshot, one source of
 * truth, rather than each page independently deciding what "the current data" is.
 *
 * Deliberately does NOT auto-fetch on mount (house style — `MetaAdsClient.tsx`'s documented
 * "manual-fetch-only" pattern, spec coordinator note #7): reads `localStorage` in an effect (not a
 * lazy `useState` initializer, since `localStorage` doesn't exist during SSR) and never calls
 * `/api/campaigns` unless `pull()` is invoked explicitly by a "Tarik data" button.
 */
export function useCampaignsSnapshot(): CampaignsSnapshotState {
  const [data, setData] = useState<AdAccountSummaryDto | undefined>(undefined);
  const [fetchedAt, setFetchedAt] = useState<number | undefined>(undefined);
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const mountedRef = useRef(true);
  const periodRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    function syncFromCache(): void {
      const cached = readCampaignsCache();
      if (cached !== undefined) {
        setData(cached.data);
        setFetchedAt(cached.fetchedAt);
        setPeriod(cached.period);
        periodRef.current = cached.period;
      }
    }
    syncFromCache();
    // Real bug fix: without this, a `pull()` from a DIFFERENT `useCampaignsSnapshot()` instance
    // on the same page (e.g. `CabangSourceClient` embedded at the top of `MetaAdsClient.tsx`)
    // left this instance showing stale data until its own `pull()` was separately triggered — see
    // `CAMPAIGNS_CACHE_UPDATED_EVENT`'s docstring in `campaignsCache.ts`.
    window.addEventListener(CAMPAIGNS_CACHE_UPDATED_EVENT, syncFromCache);
    return () => {
      window.removeEventListener(CAMPAIGNS_CACHE_UPDATED_EVENT, syncFromCache);
    };
  }, []);

  async function pull(datePreset?: string): Promise<void> {
    const resolvedPreset = datePreset ?? periodRef.current ?? DEFAULT_DATE_PRESET;
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({ datePreset: resolvedPreset, refresh: "1" });
      const res = await fetch(`/api/campaigns?${params.toString()}`);
      if (!res.ok) {
        throw new Error(await friendlyApiErrorMessage(res, "Gagal menarik data iklan."));
      }
      const body = (await res.json()) as AdAccountSummaryDto;
      if (mountedRef.current) {
        const entry: CampaignsCacheEntry = {
          data: body,
          fetchedAt: Date.now(),
          period: resolvedPreset,
        };
        writeCampaignsCache(entry);
        setData(body);
        setFetchedAt(entry.fetchedAt);
        setPeriod(resolvedPreset);
        periodRef.current = resolvedPreset;
      }
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof Error ? caught.message : "Gagal menarik data iklan.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  return { data, fetchedAt, period, loading, error, pull };
}
