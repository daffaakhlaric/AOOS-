"use client";

import { useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatMonthYearId } from "@/lib/formatters";
import { subscribeToActivityLog } from "@/lib/realtime";
import type { ActivityDto, OverviewResponseDto } from "@/types/dashboard.types";
import type { TenantMode } from "@/types/tenant.types";

import { AgentStatusRow } from "./AgentStatusRow";
import { AiScoreCard } from "./AiScoreCard";
import { ActivityFeedSection } from "./ActivityFeedSection";
import { Card } from "./Card";
import { CampaignSection } from "./CampaignSection";
import { HeatmapMiniSection } from "./HeatmapMiniSection";
import { InsightBar } from "./InsightBar";
import { KpiStrip } from "./KpiStrip";
import { LeadPipelineSection } from "./LeadPipelineSection";
import { RecyclingStatusSection } from "./RecyclingStatusSection";
import styles from "./OverviewMonitorClient.module.css";

/**
 * PROPERTY tenants' real Overview Monitor layout (AAOS Overview Monitor Phase O2) — rendered by
 * `DashboardClient.tsx`'s `isProperty` branch in place of the AUTOMOTIVE Overview content, on the
 * SAME real `/dashboard` route (`docs/PROMPT-AAOS-OVERVIEW-MONITOR.md`'s answered open question 1
 * — extend the existing route, never a new `/property/overview` one).
 *
 * Fetches O1's real `GET /api/overview` proxy ONCE on mount — every section below
 * (`KpiStrip`/`AgentStatusRow`/`CampaignSection`/`AiScoreCard`/`LeadPipelineSection`/
 * `RecyclingStatusSection`/`HeatmapMiniSection`/`InsightBar`) reads straight off that one response,
 * never a second independent fetch per section. REAL FINDING (see `CampaignSection.tsx`'s own
 * docstring): `campaignsCache.ts`'s client-side `localStorage` cache is deliberately NOT read
 * here — O1's own `campaigns` field already embeds a fresh, real server-side Meta pull
 * (`OverviewService.getCampaignsSummary` → `MetaAdsService.pullCampaigns`) as part of this SAME one
 * aggregate call, so reading the client cache instead would only serve staler/differently-windowed
 * data with no real benefit, while adding a second data path this phase has no need for. The
 * AUTOMOTIVE branch's own real `campaignsCache.ts` usage (`DashboardClient.tsx`'s existing
 * `AutomotiveOverview`) is completely untouched by this decision.
 *
 * Activity feed gets LIVE updates via the SAME real `subscribeToActivityLog` `postgres_changes`
 * subscription `ActivityLogClient.tsx` already uses (`lib/realtime.ts`) — never a new `broadcast`
 * channel (the pasted spec's own `useRealtimeActivity` mockup, corrected once already for the same
 * reason on the Activity Log page). KPI/agent/campaign/lead/recycling sections stay a real
 * periodic-refetch-free single load for this phase (matching `docs/PROMPT-AAOS-OVERVIEW-
 * MONITOR.md`'s own Finding 5 — no new per-KPI realtime channel).
 */
export function OverviewMonitorClient({
  tenantId,
  mode,
}: {
  readonly tenantId: string;
  readonly mode: TenantMode;
}): React.ReactElement {
  const [data, setData] = useState<OverviewResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [liveActivities, setLiveActivities] = useState<readonly ActivityDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/overview")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat overview.");
        }
        return (await res.json()) as OverviewResponseDto;
      })
      .then((body) => {
        if (!cancelled) {
          setData(body);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat overview.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const channel = subscribeToActivityLog(tenantId, {
      onNewActivity: (activity) => {
        setLiveActivities((prev) => [activity, ...prev].slice(0, 50));
      },
      onActivityUpdated: (activity) => {
        setLiveActivities((prev) => prev.map((row) => (row.id === activity.id ? activity : row)));
      },
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [tenantId]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <LoadingSpinner />;
  }

  // Live rows prepended, deduped by id (a live UPDATE for a row already in the historical list
  // replaces it in place rather than appearing twice) — same real merge shape
  // `ActivityLogClient.tsx`'s own `onNewActivity`/`onActivityUpdated` handlers establish.
  const liveIds = new Set(liveActivities.map((a) => a.id));
  const allActivities = [...liveActivities, ...data.activities.filter((a) => !liveIds.has(a.id))];

  return (
    <div className={styles.page} data-testid="overview-monitor">
      <div className={styles.topbar}>
        <span className={styles.date}>{formatMonthYearId(new Date(data.generatedAt))}</span>
        <span className={`${styles.modePill} ${mode === "LIVE" ? styles.modePillLive : ""}`}>
          Mode: {mode}
        </span>
      </div>

      <InsightBar insight={data.insight} />

      <KpiStrip
        leads={data.leads}
        campaigns={data.campaigns}
        agentStatus={data.agentStatus}
        recycling={data.recycling}
      />

      <AgentStatusRow agentStatus={data.agentStatus} />

      <Card title="Activity hari ini">
        <ActivityFeedSection activities={allActivities} />
      </Card>

      <div className={styles.twoCol}>
        <Card title="Campaign aktif">
          <CampaignSection campaigns={data.campaigns} />
        </Card>
        <Card title="AI self-improve score">
          <AiScoreCard agentStatus={data.agentStatus} />
        </Card>
      </div>

      <div className={styles.twoCol}>
        <Card title="Lead pipeline hari ini">
          <LeadPipelineSection leads={data.leads} />
        </Card>
        <Card title="Recycling hari ini">
          <RecyclingStatusSection recycling={data.recycling} />
        </Card>
      </div>

      <Card title="Performance heatmap — creative × audiens">
        <HeatmapMiniSection heatmap={data.heatmap} />
      </Card>
    </div>
  );
}
