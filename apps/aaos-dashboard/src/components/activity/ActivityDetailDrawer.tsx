"use client";

import { useState } from "react";

import type { ActivityDto } from "@/types/dashboard.types";

import styles from "./ActivityDetailDrawer.module.css";

const TABS = ["Output", "Reasoning", "Tool Calls", "Raw JSON"] as const;
type Tab = (typeof TABS)[number];

function jsonBlock(value: unknown): string {
  if (value === undefined) {
    return "—";
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Detail drawer for one `ActivityDto` (design doc Phase B point 4's own mockup) — 4 real tabs:
 * Output (the row's real `output`, or `devPreview` for a SIMULATED row — never both shown as if
 * real), Reasoning (`reasoning` text), Tool Calls (`toolCalls`, one entry per real
 * `ActivityLogger.logToolCall` call), Raw JSON (the whole DTO, for the honest "nothing hidden"
 * escape hatch every other detail view in this app already offers).
 */
export function ActivityDetailDrawer({
  activity,
  onClose,
}: {
  readonly activity: ActivityDto;
  readonly onClose: () => void;
}): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Output");

  return (
    <div className={styles.overlay} role="dialog" aria-label="Activity detail">
      <div className={styles.drawer}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>
              {activity.agent} — {activity.actionType}
            </h2>
            <p className={styles.subtitle}>
              {activity.mode} · {activity.status}
              {activity.durationMs !== undefined ? ` · ${activity.durationMs}ms` : ""}
            </p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose}>
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
              <pre className={styles.jsonBlock}>{jsonBlock(activity.devPreview)}</pre>
            ) : activity.status === "ERROR" ? (
              <div className={styles.errorBlock}>
                <p>{activity.errorMessage ?? "Terjadi error."}</p>
                {activity.errorStack !== undefined ? (
                  <pre className={styles.jsonBlock}>{activity.errorStack}</pre>
                ) : null}
              </div>
            ) : (
              <pre className={styles.jsonBlock}>{jsonBlock(activity.output)}</pre>
            )
          ) : null}

          {tab === "Reasoning" ? (
            <p className={styles.reasoningText}>{activity.reasoning ?? "Tidak ada reasoning."}</p>
          ) : null}

          {tab === "Tool Calls" ? (
            activity.toolCalls.length === 0 ? (
              <p className={styles.emptyState}>Tidak ada tool call.</p>
            ) : (
              <ul className={styles.toolCallList}>
                {activity.toolCalls.map((call, index) => (
                  <li key={`${call.tool}-${String(index)}`} className={styles.toolCallItem}>
                    <span className={styles.toolCallName}>{call.tool}</span>
                    <span className={styles.toolCallAt}>
                      {new Date(call.at).toLocaleString("id-ID")}
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

          {tab === "Raw JSON" ? (
            <pre className={styles.jsonBlock}>{jsonBlock(activity)}</pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}
