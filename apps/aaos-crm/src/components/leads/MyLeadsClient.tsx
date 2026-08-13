"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSalesSession } from "@/lib/session";
import type { LeadDto } from "@/types/crm.types";

import { LeadStatusBadge } from "./LeadStatusBadge";

/** Leads yang sudah di-claim (spec "/my-leads"). */
export function MyLeadsClient(): React.ReactElement {
  const { session, loading: sessionLoading } = useSalesSession();
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (session === undefined) {
      return;
    }
    fetch(`/api/leads/my?salesHumanId=${encodeURIComponent(session.salesHumanId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat leads saya.");
        }
        return (await res.json()) as { leads: readonly LeadDto[] };
      })
      .then((body) => setLeads(body.leads))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat leads saya.");
      });
  }, [session]);

  if (sessionLoading) {
    return <LoadingSpinner />;
  }
  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (leads === undefined) {
    return <LoadingSpinner />;
  }

  const activeCount = leads.filter((lead) => lead.status !== "CLOSED").length;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">📋 Leads Saya</h1>
        <span className="text-sm text-ink-muted">{activeCount} aktif</span>
      </div>
      {leads.length === 0 ? (
        <EmptyState
          title="Belum ada lead"
          description="Lead yang kamu klaim akan muncul di sini."
        />
      ) : (
        <ul data-testid="my-leads-list" className="flex flex-col gap-3">
          {leads.map((lead) => (
            <li
              key={lead.id}
              data-testid="my-lead-card"
              className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">{lead.leadName ?? lead.leadPhone}</span>
                <LeadStatusBadge status={lead.status} />
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/leads/${lead.id}`}
                  className="rounded-button border border-hairline px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Detail
                </Link>
                <Link
                  href={`/closing/new?leadId=${lead.id}`}
                  className="rounded-button bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Input Closing
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
