"use client";

import { useEffect, useState } from "react";

import type { AccountSummaryResponseDto } from "@/types/dashboard.types";

export interface AccountSummaryState {
  readonly data?: AccountSummaryResponseDto;
  readonly error?: string;
}

/**
 * Real `GET /api/campaign-health/account-summary` fetch (Command Center real-data-wiring fix) —
 * same plain fetch + `useState`/`useEffect` cancelled-flag pattern `useOverview` already
 * establishes for this app's real query strategy. Called ONCE, in `CommandCenterClient`, and its
 * result is passed down to `NeedsAttentionSummary`/`OpportunitySummary`/`SamanthaDecisionQueue` —
 * the one real, account-wide aggregate that replaces those 3 sections' previous reliance on the
 * legacy per-ad `Verdict` aggregation.
 */
export function useAccountSummary(): AccountSummaryState {
  const [data, setData] = useState<AccountSummaryResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaign-health/account-summary")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat ringkasan campaign health.");
        }
        return (await res.json()) as AccountSummaryResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Gagal memuat ringkasan campaign health.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
