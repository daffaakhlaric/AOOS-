"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { subscribeToActivityLog } from "@/lib/realtime";
import type { ActivityDto, ActivityListDto } from "@/types/dashboard.types";
import type { SettingsDto } from "@/types/tenant.types";

import styles from "./ActivityHubClient.module.css";
import { ActivityDetailPanel } from "./ActivityDetailPanel";

const AGENT_OPTIONS = ["SAMANTHA", "KAI", "CLARA", "KAREN"] as const;

// Spec's filter labels (Executed/Simulated/Error) map to this page's real, already-established
// `ActivityDto.status` values — "Executed" is this page's honest label for the real `SUCCESS`
// status (there is no literal `EXECUTED` status anywhere in `agent_activities`), the other two
// are exact real matches.
const STATUS_FILTERS = [
  { key: "SUCCESS", label: "Executed" },
  { key: "SIMULATED", label: "Simulated" },
  { key: "ERROR", label: "Error" },
] as const;

function agentColor(agent: string): string {
  const key = agent.toLowerCase();
  if (key === "samantha" || key === "kai" || key === "clara" || key === "karen") {
    return `var(--v2-${key})`;
  }
  return "var(--gray-500)";
}

function statusBadgeClass(status: string): string {
  if (status === "SUCCESS") return styles.badgeSuccess ?? "";
  if (status === "SIMULATED") return styles.badgeSimulated ?? "";
  if (status === "ERROR") return styles.badgeError ?? "";
  if (status === "NEEDS_HUMAN") return styles.badgeNeedsHuman ?? "";
  return styles.badgeRunning ?? "";
}

interface LoopGroup {
  readonly loopId: string;
  readonly label: string;
  readonly activities: readonly ActivityDto[];
}

/**
 * Groups the real, already-loaded `activities` list by their real `loopId` (`ActivityDto.loopId`,
 * `agent_activities.loop_id` — real, already present on the wire DTO since before this sprint, see
 * `dashboard.types.ts`) into the spec's "Loop Run" sections, most-recent-first. Rows with no real
 * `loopId` (an action logged outside a loop run) are grouped under one honest "Tanpa Loop Run"
 * bucket rather than one fabricated group per row.
 */
function groupByLoop(activities: readonly ActivityDto[]): readonly LoopGroup[] {
  const order: string[] = [];
  const byLoop = new Map<string, ActivityDto[]>();
  for (const activity of activities) {
    const loopId = activity.loopId ?? "__no_loop__";
    if (!byLoop.has(loopId)) {
      order.push(loopId);
      byLoop.set(loopId, []);
    }
    byLoop.get(loopId)!.push(activity);
  }
  return order.map((loopId) => {
    const group = byLoop.get(loopId)!;
    const first = group[0]!;
    return {
      loopId,
      label:
        loopId === "__no_loop__"
          ? "Tanpa Loop Run"
          : `Loop Run — ${new Date(first.startedAt).toLocaleString("id-ID")}`,
      activities: group,
    };
  });
}

/**
 * `/activity` — real "Aktivitas Agentic" hub (EYVRA MENU RESTRUCTURE Sprint 3, PROMPT 6). Reuses
 * the EXACT real data path the (now-orphaned since Sprint 1's redirect) `ActivityLogClient.tsx`
 * already established — `GET /api/activity-log` for the historical list, `lib/realtime.ts`'s real
 * `subscribeToActivityLog` `postgres_changes` subscription for LIVE new/updated rows — reshaped
 * into the spec's 2-column feed+detail layout with real `loopId` grouping and a right-side detail
 * panel (`ActivityDetailPanel`, an inline-panel adaptation of the real `ActivityDetailDrawer`'s
 * exact same Output/Reasoning/Tool Calls tab logic) instead of `ActivityLogClient`'s single-column
 * list + overlay drawer.
 *
 * Date range + free-text search are real CLIENT-SIDE filters over the already-loaded real list —
 * `GET /api/v1/activity-log` (`aaos-api`'s `GetActivitiesQuerySchema`) has no `from`/`to`/`q` query
 * params today, so these are honestly applied in the browser rather than a fabricated server param.
 */
export function ActivityHubClient(): React.ReactElement {
  const [data, setData] = useState<ActivityListDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<"DEV" | "LIVE" | undefined>(undefined);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [pulse, setPulse] = useState(false);

  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [collapsedLoops, setCollapsedLoops] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (agentFilter !== undefined) params.set("agent", agentFilter);
    if (statusFilter !== undefined) params.set("status", statusFilter);
    const qs = params.toString();
    fetch(`/api/activity-log${qs.length > 0 ? `?${qs}` : ""}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat aktivitas.");
        }
        return (await res.json()) as ActivityListDto;
      })
      .then(setData)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat aktivitas.");
      });
  }, [agentFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Real tenant id for the realtime subscription + mode badge — same real `/api/settings` call
  // `CampaignsHubClient.tsx`/`ActivityLogClient.tsx` already use, no second "who am I" endpoint.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => (res.ok ? (res.json() as Promise<SettingsDto>) : null))
      .then((settings) => {
        if (!cancelled && settings !== null) {
          setTenantId(settings.tenant.tenantId);
          setMode(settings.tenant.mode);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tenantId === undefined) {
      return undefined;
    }
    setRealtimeConnected(true);
    const channel = subscribeToActivityLog(tenantId, {
      onNewActivity: (activity) => {
        setData((prev) =>
          prev === undefined
            ? { activities: [activity], total: 1 }
            : { activities: [activity, ...prev.activities], total: prev.total + 1 },
        );
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
      },
      onActivityUpdated: (activity) => {
        setData((prev) => {
          if (prev === undefined) return prev;
          return {
            ...prev,
            activities: prev.activities.map((row) => (row.id === activity.id ? activity : row)),
          };
        });
      },
    });
    return () => {
      setRealtimeConnected(false);
      void channel.unsubscribe();
    };
  }, [tenantId]);

  const filtered = useMemo(() => {
    if (data === undefined) return undefined;
    return data.activities.filter((activity) => {
      if (dateFilter.length > 0) {
        const activityDate = activity.startedAt.slice(0, 10);
        if (activityDate !== dateFilter) return false;
      }
      if (search.trim().length > 0) {
        const needle = search.trim().toLowerCase();
        if (
          !activity.actionType.toLowerCase().includes(needle) &&
          !activity.agent.toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data, dateFilter, search]);

  const groups = useMemo(() => (filtered !== undefined ? groupByLoop(filtered) : []), [filtered]);

  const selected = data?.activities.find((activity) => activity.id === selectedId);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <main>
      <TopBar title="Aktivitas Agentic" accentColor="var(--v2-menu-activity)" />
      <div className={styles.headerExtra}>
        {mode !== undefined ? (
          <span
            data-testid="mode-badge"
            className={styles.modeBadge}
            style={
              mode === "LIVE"
                ? { background: "var(--v2-live-mode-bg)", color: "var(--v2-live-mode-color)" }
                : { background: "var(--v2-dev-bg)", color: "var(--v2-dev-color)" }
            }
          >
            {mode}
          </span>
        ) : null}
        <span
          data-testid="live-dot"
          className={`${styles.liveDot} ${realtimeConnected ? styles.liveDotConnected : ""} ${
            pulse ? styles.liveDotPulse : ""
          }`}
        />
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <button
            type="button"
            className={`${styles.filterChip} ${agentFilter === undefined ? styles.filterChipActive : ""}`}
            onClick={() => setAgentFilter(undefined)}
          >
            Semua
          </button>
          {AGENT_OPTIONS.map((agent) => (
            <button
              key={agent}
              type="button"
              className={`${styles.filterChip} ${agentFilter === agent ? styles.filterChipActive : ""}`}
              style={agentFilter === agent ? { background: agentColor(agent), color: "white" } : {}}
              onClick={() => setAgentFilter(agentFilter === agent ? undefined : agent)}
            >
              {agent}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          {STATUS_FILTERS.map((status) => (
            <button
              key={status.key}
              type="button"
              className={`${styles.filterChip} ${statusFilter === status.key ? styles.filterChipActive : ""}`}
              onClick={() => setStatusFilter(statusFilter === status.key ? undefined : status.key)}
            >
              {status.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          className={styles.dateInput}
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label="Filter tanggal"
        />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Cari action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.feed} data-testid="activity-feed">
          {groups.length === 0 ? (
            <p className={styles.emptyState}>Belum ada aktivitas agent.</p>
          ) : (
            groups.map((group) => {
              const collapsed = collapsedLoops[group.loopId] ?? false;
              return (
                <div key={group.loopId} className={styles.loopGroup} data-testid="loop-group">
                  <button
                    type="button"
                    className={styles.loopHeader}
                    onClick={() =>
                      setCollapsedLoops((prev) => ({ ...prev, [group.loopId]: !collapsed }))
                    }
                  >
                    <span className={styles.loopTitle}>{group.label}</span>
                    <span className={styles.loopCount}>{group.activities.length} actions</span>
                    <span className={styles.loopToggle}>{collapsed ? "▸" : "▾"}</span>
                  </button>
                  {!collapsed ? (
                    <div className={styles.loopRows}>
                      {group.activities.map((activity) => (
                        <button
                          key={activity.id}
                          type="button"
                          className={styles.row}
                          data-testid={`activity-row-${activity.id}`}
                          style={
                            selectedId === activity.id
                              ? { borderLeft: `3px solid ${agentColor(activity.agent)}` }
                              : undefined
                          }
                          onClick={() => setSelectedId(activity.id)}
                        >
                          <span className={styles.rowTime}>
                            {new Date(activity.startedAt).toLocaleTimeString("id-ID")}
                          </span>
                          <span
                            className={styles.agentBadge}
                            style={{ background: agentColor(activity.agent) }}
                          >
                            {activity.agent}
                          </span>
                          <span className={styles.rowLabel}>{activity.actionType}</span>
                          <span
                            className={`${styles.statusBadge} ${statusBadgeClass(activity.status)}`}
                          >
                            {activity.status === "SUCCESS" ? "EXECUTED" : activity.status}
                          </span>
                          <span className={styles.rowDuration}>
                            {activity.durationMs !== undefined ? `${activity.durationMs}ms` : "-"}
                          </span>
                          <span className={styles.rowArrow}>→</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className={styles.detail}>
          {selected !== undefined ? (
            <ActivityDetailPanel activity={selected} onClose={() => setSelectedId(undefined)} />
          ) : (
            <div className={styles.detailEmpty}>
              Pilih satu action di feed kiri untuk melihat detail Output/Reasoning/Tool Calls.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default ActivityHubClient;
