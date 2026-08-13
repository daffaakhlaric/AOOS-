"use client";

import { useEffect, useState } from "react";

import { ClosingCard } from "@/components/closing/ClosingCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSalesSession } from "@/lib/session";
import type { SalesStatsDto } from "@/types/crm.types";

import { PersonalStatsCard } from "./PersonalStatsCard";

/** Personal stats (spec "/stats"). */
export function StatsClient(): React.ReactElement {
  const { session, loading: sessionLoading } = useSalesSession();
  const [stats, setStats] = useState<SalesStatsDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    fetch(`/api/sales/stats?salesHumanId=${encodeURIComponent(session.salesHumanId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat statistik.");
        }
        return (await res.json()) as SalesStatsDto;
      })
      .then(setStats)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat statistik.");
      });
  }, [session]);

  if (sessionLoading) {
    return <LoadingSpinner />;
  }
  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (stats === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-ink">📊 Statistik Saya</h1>
      <PersonalStatsCard stats={stats} />
      <div>
        <h2 className="text-sm font-semibold text-ink">Closing Terbaru</h2>
        {stats.recentClosings.length === 0 ? (
          <div className="mt-2">
            <EmptyState title="Belum ada closing" />
          </div>
        ) : (
          <ul data-testid="recent-closings-list" className="mt-2 flex flex-col gap-3">
            {stats.recentClosings.map((closing) => (
              <ClosingCard key={closing.id} closing={closing} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
