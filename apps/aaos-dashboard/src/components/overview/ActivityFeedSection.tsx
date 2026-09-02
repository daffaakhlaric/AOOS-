"use client";

import { useState } from "react";

import { ActivityDetailDrawer } from "@/components/activity/ActivityDetailDrawer";
import type { ActivityDto } from "@/types/dashboard.types";

import { agentColorFor } from "./agentColors";
import styles from "./ActivityFeedSection.module.css";

/** Same real status→style mapping `ActivityLogClient.tsx` already establishes (`statusBadgeClass`/`statusLabel`) — mirrored here (not imported, that file's helpers are module-local) rather than duplicated logic drifting silently apart; keep both in sync if a new status is ever added. */
function statusClass(status: string): string {
  if (status === "SUCCESS") {
    return styles.statusSuccess ?? "";
  }
  if (status === "SIMULATED") {
    return styles.statusSimulated ?? "";
  }
  if (status === "ERROR") {
    return styles.statusError ?? "";
  }
  if (status === "NEEDS_HUMAN") {
    return styles.statusNeedsHuman ?? "";
  }
  return styles.statusRunning ?? "";
}

function statusLabel(status: string): string {
  return status === "NEEDS_HUMAN" ? "🟠 Butuh Tindakan" : status;
}

/**
 * Compact activity feed for the Overview page's "Activity Log + Detail Panel" split (spec "BAGIAN
 * 5") — real `activities` rows from O1's own `OverviewResponseDto.activities` (already the same
 * `GET /api/v1/activity-log`-shaped rows, reused in-process server-side, per that field's own doc).
 * Row rendering closely mirrors `ActivityLogClient.tsx`'s real conventions (agent color coding,
 * `NEEDS_HUMAN` badge treatment) rather than inventing a parallel look. Clicking a row opens the
 * SAME real `ActivityDetailDrawer` that page already uses — no second, parallel detail-panel
 * component built from the pasted spec's own 3-tab mockup.
 */
export function ActivityFeedSection({
  activities,
}: {
  readonly activities: readonly ActivityDto[];
}): React.ReactElement {
  const [selected, setSelected] = useState<ActivityDto | undefined>(undefined);

  if (activities.length === 0) {
    return <p className={styles.empty}>Belum ada aktivitas agent hari ini.</p>;
  }

  return (
    <>
      <div className={styles.list} data-testid="overview-activity-feed">
        {activities.map((activity) => {
          const color = agentColorFor(activity.agent);
          return (
            <button
              key={activity.id}
              type="button"
              className={styles.row}
              onClick={() => setSelected(activity)}
              style={{ "--agent-color": color } as React.CSSProperties}
            >
              <span className={styles.time}>
                {new Date(activity.startedAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className={styles.agentBadge}>{activity.agent}</span>
              <span className={styles.label}>{activity.actionType}</span>
              <span className={`${styles.statusBadge} ${statusClass(activity.status)}`}>
                {statusLabel(activity.status)}
              </span>
              <span className={styles.duration}>
                {activity.durationMs !== undefined
                  ? `${(activity.durationMs / 1000).toFixed(1)}s`
                  : "—"}
              </span>
            </button>
          );
        })}
      </div>
      {selected !== undefined ? (
        <ActivityDetailDrawer activity={selected} onClose={() => setSelected(undefined)} />
      ) : null}
    </>
  );
}
