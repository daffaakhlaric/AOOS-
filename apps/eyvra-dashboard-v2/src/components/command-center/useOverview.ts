"use client";

import { useEffect, useState } from "react";

import type { OverviewResponseDto } from "@/types/dashboard.types";

/** Real GET /api/overview fetch, plain fetch + useState/useEffect with the cancelled-flag cleanup pattern apps/eyvra-dashboard's own CommandCenterClient.tsx establishes — this codebase's real query strategy, reused rather than introducing React Query/SWR. */
export function useOverview(): { data?: OverviewResponseDto; error?: string } {
  const [data, setData] = useState<OverviewResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/overview", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat Command Center.");
        }
        return (await res.json()) as OverviewResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Command Center.");
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { data, error };
}
