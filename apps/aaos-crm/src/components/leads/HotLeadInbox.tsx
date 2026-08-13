"use client";

import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RealtimeBadge } from "@/components/ui/RealtimeBadge";
import { subscribeToHotLeads } from "@/lib/realtime";
import { useSalesSession } from "@/lib/session";
import type { LeadDto } from "@/types/crm.types";

import { HotLeadCard } from "./HotLeadCard";

/** Hot leads inbox — the main page (spec "/leads"). Fetches `/api/leads?branchId=...` for the initial list, then keeps it live via `lib/realtime.ts`'s direct Supabase subscription (coordinator note #1's one deliberate exception). Shows a toast when a new hot lead arrives and removes a lead from the list the moment ANY sales human claims it (spec "🔥 Hot lead baru masuk!" / "Lead di-claim → update card"). */
export function HotLeadInbox(): React.ReactElement {
  const { session, loading: sessionLoading } = useSalesSession();
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<string | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (session?.branchId === undefined) {
      return;
    }
    fetch(`/api/leads?branchId=${encodeURIComponent(session.branchId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat hot leads.");
        }
        return (await res.json()) as { leads: readonly LeadDto[] };
      })
      .then((body) => setLeads(body.leads.filter((lead) => lead.status === "HOT")))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat hot leads.");
      });
  }, [session?.branchId]);

  useEffect(() => {
    if (session?.branchId === undefined) {
      return;
    }
    const channel = subscribeToHotLeads(session.branchId, {
      onNewLead: (lead) => {
        setLeads((current) => [lead, ...(current ?? [])]);
        setToast(`🔥 Hot lead baru masuk! ${lead.leadName ?? lead.leadPhone}`);
        if (toastTimer.current !== undefined) {
          clearTimeout(toastTimer.current);
        }
        toastTimer.current = setTimeout(() => setToast(undefined), 5000);
      },
      onLeadClaimed: (leadId) => {
        setLeads((current) => current?.filter((lead) => lead.id !== leadId));
      },
    });
    setConnected(true);
    return () => {
      void channel.unsubscribe();
    };
  }, [session?.branchId]);

  if (sessionLoading) {
    return <LoadingSpinner />;
  }
  if (session === undefined) {
    return <ErrorCard message="Sesi tidak ditemukan. Silakan login ulang." />;
  }
  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (leads === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">🔥 Hot Leads</h1>
          <p className="text-sm text-ink-muted">Lead panas siap di-follow up</p>
        </div>
        <RealtimeBadge connected={connected} />
      </div>
      {toast !== undefined ? (
        <div
          data-testid="new-lead-toast"
          role="status"
          className="rounded-card border border-brand-primary/30 bg-brand-primary/10 p-3 text-sm font-medium text-brand-primary"
        >
          {toast}
        </div>
      ) : null}
      {leads.length === 0 ? (
        <EmptyState
          title="Belum ada hot lead"
          description="Hot lead baru akan muncul di sini secara realtime."
        />
      ) : (
        <ul data-testid="hot-leads-list" className="flex flex-col gap-3">
          {leads.map((lead) => (
            <HotLeadCard
              key={lead.id}
              lead={lead}
              salesHumanId={session.salesHumanId}
              onClaimed={(leadId) => setLeads((current) => current?.filter((l) => l.id !== leadId))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
