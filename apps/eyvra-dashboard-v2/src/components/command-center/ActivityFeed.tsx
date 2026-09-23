"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/common/EmptyState";
import { presentLabel, presentText } from "@/lib/presentation";
import type { ActivityDto } from "@/types/dashboard.types";

import styles from "./ActivityFeed.module.css";

const AGENT_COLOR_VAR: Record<string, string> = {
  SAMANTHA: "--samantha",
  KAI: "--kai",
  CLARA: "--clara",
};
const AGENT_LABEL: Record<string, string> = { SAMANTHA: "Samantha", KAI: "Kai", CLARA: "Clara" };

const STATUS_TONE: Record<string, string> = {
  SUCCESS: "success",
  SIMULATED: "info",
  ERROR: "critical",
  PENDING: "warning",
};

const ACTION_TYPE_LABEL: Record<string, string> = {
  EXECUTE_VERDICT: "Menerapkan keputusan campaign",
  VERDICT_APPLIED: "Keputusan campaign diterapkan",
  VERDICT_REJECTED: "Keputusan campaign ditolak",
  ROLLBACK: "Rollback aksi sebelumnya",
  CREATE_CAMPAIGN: "Membuat campaign baru",
  CREATE_PROPERTY_CAMPAIGN: "Membuat campaign property baru",
  CAMPAIGN_PUBLISHED: "Campaign dipublikasikan",
  CAMPAIGN_PUBLISH_FROM_ASSET: "Campaign dipublikasikan dari asset",
  PUBLISH_CAMPAIGN_FROM_ASSET: "Campaign dipublikasikan dari asset",
  CAMPAIGN_RESTRUCTURED: "Campaign direstrukturisasi",
  RESTRUCTURE_CAMPAIGN: "Merestrukturisasi campaign",
  CAMPAIGN_TRIGGER_RECOMMENDATION: "Rekomendasi campaign baru",
  ANDROMEDA_RESTRUCTURE_DETECTED: "Restrukturisasi campaign terdeteksi",
  AUTONOMOUS_CAMPAIGN_CREATION: "Campaign dibuat otomatis",
  CREATIVE_AUTO_GENERATE: "Membuat creative otomatis",
  CREATIVE_BRIEF_CREATED: "Brief creative dibuat",
  CREATIVE_GENERATED: "Creative selesai dibuat",
  CREATIVE_NEEDS_MANUAL_SHOOT: "Creative butuh foto manual",
  REVIEW_CREATIVE_BRIEF: "Meninjau brief creative",
  FATIGUE_DETECTED: "Creative fatigue terdeteksi",
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Berhasil",
  SIMULATED: "Simulasi",
  ERROR: "Gagal",
  PENDING: "Berjalan",
};

const MAX_ROWS = 20;

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

type AgentFilter = "ALL" | "SAMANTHA" | "KAI" | "CLARA";

function actionLabel(activity: ActivityDto): string {
  return ACTION_TYPE_LABEL[activity.actionType] ?? presentLabel(activity.actionType);
}

/** Real `HH.mm` in the tenant's operating timezone — the same Asia/Jakarta basis the Topbar's last-sync time uses. */
function rowTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: JAKARTA_TIME_ZONE,
  })
    .format(new Date(iso))
    .replace(":", ".");
}

/** Stable `YYYY-MM-DD` calendar-date key for a real `createdAt`, evaluated in Asia/Jakarta. */
function dateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: JAKARTA_TIME_ZONE,
  }).format(date);
}

/** "18 Sep" — Indonesian short month, same locale every other date in this app is formatted with. */
function dayMonthLabel(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: JAKARTA_TIME_ZONE,
  }).format(new Date(iso));
}

interface ActivityDateGroup {
  readonly key: string;
  readonly heading: string;
  readonly entries: readonly ActivityDto[];
}

/**
 * Groups the real, already-capped rows by their REAL `createdAt` calendar date (Asia/Jakarta), in
 * the order the rows themselves arrive — so a heading only ever exists because at least one real
 * activity falls on that date. Today's group reads "Today, 18 Sep"; every other group is just
 * "18 Sep". No date is ever hardcoded, and no empty date group is ever emitted.
 */
function groupByRealDate(entries: readonly ActivityDto[], now: Date): readonly ActivityDateGroup[] {
  const todayKey = dateKey(now);
  const order: string[] = [];
  const buckets = new Map<string, ActivityDto[]>();
  for (const entry of entries) {
    const key = dateKey(new Date(entry.createdAt));
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      order.push(key);
      buckets.set(key, [entry]);
    } else {
      bucket.push(entry);
    }
  }
  return order.map((key) => {
    const bucket = buckets.get(key) ?? [];
    const first = bucket[0];
    const dayMonth = first !== undefined ? dayMonthLabel(first.createdAt) : key;
    return {
      key,
      heading: key === todayKey ? `Today, ${dayMonth}` : dayMonth,
      entries: bucket,
    };
  });
}

/**
 * A real secondary detail line, or `undefined` when there genuinely is none. `reasoning` is the real
 * agent-written explanation; `errorMessage` is the real failure text. Neither is ever synthesised,
 * and the line is suppressed when it would merely repeat the action label above it.
 */
function secondaryDetail(activity: ActivityDto): string | undefined {
  const raw = activity.reasoning ?? activity.errorMessage;
  if (raw === undefined || raw.trim().length === 0) return undefined;
  const detail = presentText(raw);
  return detail === actionLabel(activity) ? undefined : detail;
}

/** Single-letter avatar glyph from the real agent name — never a raw enum token. */
function agentInitial(agent: string): string {
  const label = AGENT_LABEL[agent] ?? presentLabel(agent);
  return label.slice(0, 1).toUpperCase();
}

export function ActivityFeed({
  activities,
}: {
  readonly activities: readonly ActivityDto[];
}): React.ReactElement {
  const [filter, setFilter] = useState<AgentFilter>("ALL");

  const filtered = useMemo(
    () => (filter === "ALL" ? activities : activities.filter((a) => a.agent === filter)),
    [activities, filter],
  );

  const groups = useMemo(
    () => groupByRealDate(filtered.slice(0, MAX_ROWS), new Date()),
    [filtered],
  );

  return (
    <div className={styles.rail}>
      <div className={styles.headerRow}>
        <h2 className={styles.headerTitle}>Agent Activity</h2>
        <select
          id="cc-activity-agent-filter"
          className={styles.filterSelect}
          aria-label="Filter aktivitas per agent"
          value={filter}
          onChange={(event) => setFilter(event.target.value as AgentFilter)}
          data-testid="cc-activity-filter"
        >
          <option value="ALL">All Agents</option>
          <option value="SAMANTHA">Samantha</option>
          <option value="KAI">Kai</option>
          <option value="CLARA">Clara</option>
        </select>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          title="Belum ada aktivitas agent"
          description="Aktivitas Samantha/Kai/Clara akan muncul di sini begitu mereka mulai bekerja."
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title="Tidak ada aktivitas untuk agent ini"
          description="Coba pilih 'All Agents' untuk melihat seluruh aktivitas real yang tercatat."
        />
      ) : (
        <div className={styles.timeline} data-testid="cc-activity-feed">
          {groups.map((group) => (
            <section key={group.key} className={styles.group}>
              <p className={styles.groupHeading} data-testid="cc-activity-date-group">
                {group.heading}
              </p>
              <ul className={styles.list}>
                {group.entries.map((activity) => {
                  const detail = secondaryDetail(activity);
                  const colorVar = AGENT_COLOR_VAR[activity.agent];
                  return (
                    <li key={activity.id} className={styles.row}>
                      <span className={styles.time}>{rowTime(activity.createdAt)}</span>
                      <span
                        className={styles.avatar}
                        style={
                          colorVar !== undefined ? { background: `var(${colorVar})` } : undefined
                        }
                        aria-hidden="true"
                      >
                        {agentInitial(activity.agent)}
                      </span>
                      <div className={styles.body}>
                        <p className={styles.agentName}>
                          {AGENT_LABEL[activity.agent] ?? presentLabel(activity.agent)}
                        </p>
                        <p className={styles.action}>{actionLabel(activity)}</p>
                        {detail !== undefined ? (
                          <p className={styles.detail} title={detail}>
                            {detail}
                          </p>
                        ) : null}
                        <span
                          className={`${styles.statusBadge} ${styles[`tone_${STATUS_TONE[activity.status] ?? "neutral"}`]}`}
                        >
                          {STATUS_LABEL[activity.status] ?? presentLabel(activity.status)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Link href="/activity" className={styles.footerLink}>
        View All Activity →
      </Link>
    </div>
  );
}
