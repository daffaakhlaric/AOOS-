"use client";

import { useState } from "react";

import type { ActivityDto } from "@/types/dashboard.types";

import styles from "./ActivityDetailPanel.module.css";

const TABS = ["Output", "Reasoning", "Tool Calls"] as const;
type Tab = (typeof TABS)[number];

function jsonBlock(value: unknown): string {
  if (value === undefined) return "—";
  return JSON.stringify(value, null, 2);
}

/**
 * Right-side (spec: ~40% column) detail panel for one selected `ActivityDto`, shown inline next to
 * the feed instead of the real `ActivityDetailDrawer`'s overlay/modal presentation — same real 3
 * tabs (Output/Reasoning/Tool Calls) and the exact same real field reads (`devPreview` for
 * SIMULATED, `errorMessage`/`errorStack` for ERROR, `output` otherwise; `reasoning`; `toolCalls`)
 * `ActivityDetailDrawer.tsx` already established, adapted to a non-overlay layout for
 * `ActivityHubClient.tsx`'s 2-column shape (spec PROMPT 6) rather than duplicated as a 4th "Raw
 * JSON" tab that spec doesn't ask for here.
 */
export function ActivityDetailPanel({
  activity,
  onClose,
}: {
  readonly activity: ActivityDto;
  readonly onClose: () => void;
}): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Output");

  return (
    <div className={styles.panel} data-testid="activity-detail-panel">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            {activity.agent} — {activity.actionType}
          </h2>
          <p className={styles.subtitle}>
            {activity.mode} · {activity.status}
            {activity.durationMs !== undefined ? ` · ${activity.durationMs}ms` : ""}
            {" · "}
            {new Date(activity.startedAt).toLocaleString("id-ID")}
          </p>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Tutup">
          ✕
        </button>
      </div>

      <div className={styles.tabs}>
        {TABS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`${styles.tab} ${tab === candidate ? styles.tabActive : ""}`}
            onClick={() => setTab(candidate)}
          >
            {candidate}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {tab === "Output" ? (
          activity.status === "SIMULATED" ? (
            <>
              <p className={styles.devBanner}>
                DEV mode preview — hasil di bawah ini adalah simulasi, belum dieksekusi nyata.
              </p>
              <pre className={styles.jsonBlock}>{jsonBlock(activity.devPreview)}</pre>
            </>
          ) : activity.status === "ERROR" ? (
            <div className={styles.errorBlock}>
              <p>{activity.errorMessage ?? "Terjadi error."}</p>
              {activity.errorStack !== undefined ? (
                <pre className={styles.jsonBlock}>{activity.errorStack}</pre>
              ) : null}
            </div>
          ) : (
            <>
              {activity.mode === "LIVE" ? (
                <p className={styles.liveBanner}>Hasil eksekusi nyata (LIVE mode).</p>
              ) : null}
              <pre className={styles.jsonBlock}>{jsonBlock(activity.output)}</pre>
            </>
          )
        ) : null}

        {tab === "Reasoning" ? (
          <div className={styles.reasoningBox}>
            <p className={styles.reasoningText}>{activity.reasoning ?? "Tidak ada reasoning."}</p>
          </div>
        ) : null}

        {tab === "Tool Calls" ? (
          activity.toolCalls.length === 0 ? (
            <p className={styles.emptyState}>Tidak ada tool call.</p>
          ) : (
            <ul className={styles.toolCallList}>
              {activity.toolCalls.map((call, index) => (
                <li key={`${call.tool}-${String(index)}`} className={styles.toolCallItem}>
                  <span className={styles.toolCallName}>{call.tool}</span>
                  <span className={styles.toolCallStatus}>
                    {activity.status === "SIMULATED"
                      ? "SIM"
                      : activity.status === "ERROR"
                        ? "error"
                        : "success"}
                  </span>
                  <span className={styles.toolCallAt}>
                    {new Date(call.at).toLocaleTimeString("id-ID")}
                  </span>
                  {call.input !== undefined ? (
                    <pre className={styles.jsonBlock}>{jsonBlock(call.input)}</pre>
                  ) : null}
                  {call.output !== undefined ? (
                    <pre className={styles.jsonBlock}>{jsonBlock(call.output)}</pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}

export default ActivityDetailPanel;
