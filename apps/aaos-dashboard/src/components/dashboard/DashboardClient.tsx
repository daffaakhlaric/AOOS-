"use client";

import { useEffect, useState } from "react";

import { ObjectiveProgress, type OnTrackStatus } from "@/components/dashboard/ObjectiveProgress";
import { RecentHotLeads } from "@/components/dashboard/RecentHotLeads";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { TamaraDigest } from "@/components/dashboard/TamaraDigest";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { LeadDto, ObjectiveDto } from "@/types/dashboard.types";

import styles from "./DashboardClient.module.css";

/** Derives an `OnTrackStatus` from a simple progress ratio — a placeholder until `GetObjectiveStatus`/`ForecastObjective` are wired to a real `aaos-api` endpoint (see `README.md`'s "Known limitations"). */
function deriveOnTrackStatus(fraction: number): OnTrackStatus {
  if (fraction >= 0.85) {
    return "ON_TRACK";
  }
  if (fraction >= 0.6) {
    return "AT_RISK";
  }
  return "OFF_TRACK";
}

/**
 * Fetches this app's own `/api/leads` and `/api/objective` proxy routes and renders the overview
 * (spec "dashboard/page.tsx").
 *
 * Real bug fix: this used to also call `/api/campaigns` (which proxies to Meta's Insights API via
 * `aaos-api`) on every single mount — the dashboard overview is the page every manager lands on
 * first, so that single unconditional Meta call fired on every visit, every tab reopen, every
 * navigation back to `/dashboard`, which was enough on its own to trip Meta's rate limit. The
 * overview now only reads Supabase-backed data — `leads` (`@aos/lead-store`, via `/api/leads`)
 * and `objective` (`@aos/objective-engine`, via `/api/objective` — config the manager sets, not a
 * Meta API call) — never Meta Ads data. Belanja/D3 Lead are consequently no longer shown here;
 * see `SummaryCards.tsx`'s docstring. Meta Ads figures live on `/meta-ads`, which only fetches on
 * an explicit "Tarik Data" click (see `MetaAdsClient.tsx`).
 */
export function DashboardClient(): React.ReactElement {
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [objective, setObjective] = useState<ObjectiveDto | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [leadsRes, objectiveRes] = await Promise.all([
          fetch("/api/leads"),
          fetch("/api/objective"),
        ]);
        if (!leadsRes.ok || !objectiveRes.ok) {
          throw new Error("Gagal memuat data dashboard.");
        }
        const leadsBody = (await leadsRes.json()) as { leads: readonly LeadDto[] };
        const objectiveBody = (await objectiveRes.json()) as { objective: ObjectiveDto | null };
        if (!cancelled) {
          setLeads(leadsBody.leads);
          setObjective(objectiveBody.objective);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat data dashboard.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (leads === undefined || objective === undefined) {
    return <LoadingSpinner />;
  }

  const hotLeadCount = leads.filter((lead) => lead.temperature === "HOT").length;
  const closingCount = leads.filter((lead) => lead.status === "CLOSED").length;
  const targetHotLeads = objective?.targetHotLeads ?? 0;
  const fraction = targetHotLeads > 0 ? Math.min(1, hotLeadCount / targetHotLeads) : 0;

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>🎯 Overview Bulan Ini</h2>
      <SummaryCards
        data={{
          hotLeads: hotLeadCount,
          hotLeadsChangePercent: 0,
          closings: closingCount,
          closingsChangePercent: 0,
        }}
      />
      {objective !== null ? (
        <ObjectiveProgress
          data={{
            targetHotLeads,
            currentHotLeads: hotLeadCount,
            onTrackStatus: deriveOnTrackStatus(fraction),
          }}
        />
      ) : null}
      <TamaraDigest text="Hari ini pause 3 iklan boros (hemat Rp 1.2jt). Scale #C047 karena Rp/D3 di bawah target." />
      <div>
        <h3 className={styles.sectionTitle}>🔥 Hot Leads Terbaru</h3>
        <RecentHotLeads leads={leads} />
      </div>
    </div>
  );
}
