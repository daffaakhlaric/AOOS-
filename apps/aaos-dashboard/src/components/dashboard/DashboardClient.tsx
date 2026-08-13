"use client";

import { useEffect, useState } from "react";

import { ObjectiveProgress, type OnTrackStatus } from "@/components/dashboard/ObjectiveProgress";
import { RecentHotLeads } from "@/components/dashboard/RecentHotLeads";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { TamaraDigest } from "@/components/dashboard/TamaraDigest";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { AdAccountSummaryDto, LeadDto, ObjectiveDto } from "@/types/dashboard.types";

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

/** Fetches everything `/dashboard` needs from this app's own `/api/*` proxy routes and renders the overview (spec "dashboard/page.tsx"). */
export function DashboardClient(): React.ReactElement {
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [objective, setObjective] = useState<ObjectiveDto | null | undefined>(undefined);
  const [campaigns, setCampaigns] = useState<AdAccountSummaryDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [leadsRes, objectiveRes, campaignsRes] = await Promise.all([
          fetch("/api/leads"),
          fetch("/api/objective"),
          fetch("/api/campaigns"),
        ]);
        if (!leadsRes.ok || !objectiveRes.ok || !campaignsRes.ok) {
          throw new Error("Gagal memuat data dashboard.");
        }
        const leadsBody = (await leadsRes.json()) as { leads: readonly LeadDto[] };
        const objectiveBody = (await objectiveRes.json()) as { objective: ObjectiveDto | null };
        const campaignsBody = (await campaignsRes.json()) as AdAccountSummaryDto;
        if (!cancelled) {
          setLeads(leadsBody.leads);
          setObjective(objectiveBody.objective);
          setCampaigns(campaignsBody);
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
  if (leads === undefined || objective === undefined || campaigns === undefined) {
    return <LoadingSpinner />;
  }

  const hotLeadCount = leads.filter((lead) => lead.temperature === "HOT").length;
  const closingCount = leads.filter((lead) => lead.status === "CLOSED").length;
  const targetHotLeads = objective?.targetHotLeads ?? 0;
  const fraction = targetHotLeads > 0 ? Math.min(1, hotLeadCount / targetHotLeads) : 0;

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-base font-semibold text-ink">🎯 Overview Bulan Ini</h2>
      <SummaryCards
        data={{
          spend: campaigns.totals.spend,
          spendChangePercent: 0,
          d3Leads: campaigns.totals.d3,
          d3ChangePercent: 0,
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
        <h3 className="mb-2 text-sm font-semibold text-ink">🔥 Hot Leads Terbaru</h3>
        <RecentHotLeads leads={leads} />
      </div>
    </div>
  );
}
