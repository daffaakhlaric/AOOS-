"use client";

import { useCallback, useEffect, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { subscribeToActivityLog } from "@/lib/realtime";
import type { ActivityDto, ActivityListDto } from "@/types/dashboard.types";
import type { SettingsDto } from "@/types/tenant.types";

import styles from "./ActivityLogClient.module.css";
import { ActivityDetailDrawer } from "./ActivityDetailDrawer";

const STATUS_OPTIONS = ["RUNNING", "SUCCESS", "SIMULATED", "ERROR"] as const;
const MODE_OPTIONS = ["DEV", "LIVE"] as const;

function statusBadgeClass(status: string): string {
  if (status === "SUCCESS") {
    return styles.badgeSuccess ?? "";
  }
  if (status === "SIMULATED") {
    return styles.badgeSimulated ?? "";
  }
  if (status === "ERROR") {
    return styles.badgeError ?? "";
  }
  return styles.badgeRunning ?? "";
}

/**
 * `/property/activity` — real Activity Log page (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B): one
 * row per gated agent action `ActivityLogger` recorded (today: `MetaAdsService.executeVerdict`,
 * `CampaignsService.createCampaign`). Historical list via `GET /api/activity-log`, LIVE updates
 * via `lib/realtime.ts`'s `subscribeToActivityLog` — a real `postgres_changes` subscription on
 * `agent_activities` INSERT/UPDATE, never a manually-sent broadcast (see that function's own doc).
 */
export function ActivityLogClient(): React.ReactElement {
  const [data, setData] = useState<ActivityListDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [selected, setSelected] = useState<ActivityDto | undefined>(undefined);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (agentFilter.length > 0) {
      params.set("agent", agentFilter);
    }
    if (statusFilter.length > 0) {
      params.set("status", statusFilter);
    }
    if (modeFilter.length > 0) {
      params.set("mode", modeFilter);
    }
    const qs = params.toString();
    fetch(`/api/activity-log${qs.length > 0 ? `?${qs}` : ""}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat activity log.");
        }
        return (await res.json()) as ActivityListDto;
      })
      .then(setData)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat activity log.");
      });
  }, [agentFilter, statusFilter, modeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Real tenant id for the realtime subscription's `tenant_id=eq.<id>` filter — same real
  // `/api/settings` fetch `Sidebar.tsx` already uses to resolve `vertical` (no second "who am I"
  // endpoint invented for this page).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => (res.ok ? (res.json() as Promise<SettingsDto>) : null))
      .then((settings) => {
        if (!cancelled && settings?.tenant.tenantId !== undefined) {
          setTenantId(settings.tenant.tenantId);
        }
      })
      .catch(() => {
        // Best-effort — a failed lookup just means no realtime subscription; the historical list still loads.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tenantId === undefined) {
      return undefined;
    }
    const channel = subscribeToActivityLog(tenantId, {
      onNewActivity: (activity) => {
        setData((prev) =>
          prev === undefined
            ? { activities: [activity], total: 1 }
            : { activities: [activity, ...prev.activities], total: prev.total + 1 },
        );
      },
      onActivityUpdated: (activity) => {
        setData((prev) => {
          if (prev === undefined) {
            return prev;
          }
          return {
            ...prev,
            activities: prev.activities.map((row) => (row.id === activity.id ? activity : row)),
          };
        });
        setSelected((prev) => (prev?.id === activity.id ? activity : prev));
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

  return (
    <main>
      <TopBar title="Activity Log" />
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <select
            className={styles.filterSelect}
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="">Semua Agent</option>
            <option value="SAMANTHA">Samantha</option>
            <option value="CLARA">Clara</option>
            <option value="KAI">Kai</option>
            <option value="KAREN">Karen</option>
          </select>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
          >
            <option value="">Semua Mode</option>
            {MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>

        {data.activities.length === 0 ? (
          <p className={styles.emptyState}>Belum ada aktivitas agent.</p>
        ) : (
          <div className={styles.list} data-testid="activity-list">
            {data.activities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className={styles.row}
                onClick={() => setSelected(activity)}
              >
                <span className={styles.rowAgent}>{activity.agent}</span>
                <span className={styles.rowAction}>{activity.actionType}</span>
                <span className={styles.rowMode}>{activity.mode}</span>
                <span className={`${styles.badge} ${statusBadgeClass(activity.status)}`}>
                  {activity.status}
                </span>
                <span className={styles.rowTime}>
                  {new Date(activity.startedAt).toLocaleString("id-ID")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected !== undefined ? (
        <ActivityDetailDrawer activity={selected} onClose={() => setSelected(undefined)} />
      ) : null}
    </main>
  );
}
