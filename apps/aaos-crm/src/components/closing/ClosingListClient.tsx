"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSalesSession } from "@/lib/session";
import type { ClosingDto } from "@/types/crm.types";

import { ClosingCard } from "./ClosingCard";

/** Closing list — this month's own closings (spec "/closing"). */
export function ClosingListClient(): React.ReactElement {
  const { session, loading: sessionLoading } = useSalesSession();
  const [closings, setClosings] = useState<readonly ClosingDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    fetch(`/api/closings?salesHumanId=${encodeURIComponent(session.salesHumanId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat closing.");
        }
        return (await res.json()) as { closings: readonly ClosingDto[] };
      })
      .then((body) => setClosings(body.closings))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat closing.");
      });
  }, [session]);

  if (sessionLoading) {
    return <LoadingSpinner />;
  }
  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (closings === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">✅ Closing</h1>
        <Link
          href="/closing/new"
          className="rounded-button bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white"
        >
          + Input Closing
        </Link>
      </div>
      {closings.length === 0 ? (
        <EmptyState
          title="Belum ada closing bulan ini"
          description="Closing/SPK yang kamu input akan muncul di sini."
        />
      ) : (
        <ul data-testid="closings-list" className="flex flex-col gap-3">
          {closings.map((closing) => (
            <ClosingCard key={closing.id} closing={closing} />
          ))}
        </ul>
      )}
    </div>
  );
}
