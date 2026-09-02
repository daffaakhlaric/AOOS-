"use client";

import { useState } from "react";

import { ActivityDetailDrawer } from "@/components/activity/ActivityDetailDrawer";
import { Badge, type BadgeType } from "@/components/ui/Badge";
import type { ActivityDto } from "@/types/dashboard.types";

import { agentColorFor } from "./agentColors";
import styles from "./ActivityFeedSection.module.css";

/**
 * Real status -> `Badge` `BadgeType` mapping (Brand Guideline v2, Phase B3, Prompt 6). REAL
 * DATA-SHAPE DEVIATION from the spec: this activity feed's real statuses (mirrored from
 * `ActivityLogClient.tsx`'s own `statusBadgeClass`/`statusLabel`) are `SUCCESS`/`SIMULATED`/
 * `ERROR`/`NEEDS_HUMAN`/(running, the default) — the spec's own `BadgeType` union has `EXECUTED`
 * (not `SUCCESS`) and `RUNNING`, and no `NEEDS_HUMAN` entry at all. `SUCCESS` maps to `Badge`'s
 * `EXECUTED` type (closest real semantic match: a completed, real action). `NEEDS_HUMAN` has no
 * matching `BadgeType` — kept as the existing local amber styling (`statusNeedsHuman`) rather than
 * force-fitting it into an unrelated color, since fabricating a badge type for it would drift from
 * `Badge`'s own real, tested `BADGE_CONFIG` table.
 */
function badgeTypeFor(status: string): BadgeType | undefined {
  if (status === "SUCCESS") {
    return "EXECUTED";
  }
  if (status === "SIMULATED") {
    return "SIMULATED";
  }
  if (status === "ERROR") {
    return "ERROR";
  }
  if (status === "NEEDS_HUMAN") {
    return undefined;
  }
  return "RUNNING";
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
 *
 * COLORFUL BRAND GUIDELINE V2 (Phase B3, Prompt 6): 3px colored left border per agent (always-on,
 * not just on hover/select — this feed has no selected-row concept, clicking opens a drawer rather
 * than setting row state), solid colored agent badge (local `span` — "AGENT" isn't a `Badge`
 * `BadgeType`, it's an agent name, so it reuses `agentColorFor` directly rather than the shared
 * `Badge` component), and the status pill now renders via the real, shared `Badge` component for
 * every status it has a match for (see `badgeTypeFor` above).
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
          const badgeType = badgeTypeFor(activity.status);
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
              <span className={styles.agentBadge} style={{ background: color }}>
                {activity.agent}
              </span>
              <span className={styles.label}>{activity.actionType}</span>
              {badgeType !== undefined ? (
                <Badge type={badgeType} size="xs" />
              ) : (
                <span className={`${styles.statusBadge} ${styles.statusNeedsHuman}`}>
                  {statusLabel(activity.status)}
                </span>
              )}
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
