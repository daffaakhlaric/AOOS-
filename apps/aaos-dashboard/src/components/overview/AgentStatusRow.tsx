import type { OverviewAgentScoreDto } from "@/types/dashboard.types";

import { agentColorFor } from "./agentColors";
import styles from "./AgentStatusRow.module.css";

const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AGENT_LABEL: Readonly<Record<OverviewAgentScoreDto["agent"], string>> = {
  SAMANTHA: "Samantha",
  KAI: "Kai",
  CLARA: "Clara",
};

function ScoreRing({
  score,
  color,
}: {
  readonly score: number;
  readonly color: string;
}): React.ReactElement {
  const offset =
    RING_CIRCUMFERENCE - (Math.min(Math.max(score, 0), 100) / 100) * RING_CIRCUMFERENCE;
  return (
    <div className={styles.ringWrap}>
      <svg width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx="20"
          cy="20"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--gray-200)"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={styles.ringLabel} style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

/**
 * 3 real agent cards — SAMANTHA/KAI/CLARA only (`docs/PROMPT-AAOS-OVERVIEW-MONITOR.md` Finding 1:
 * no "Karen" card, zero real implementation anywhere in this codebase). Reads O1's real
 * `OverviewResponseDto.agentStatus` array directly (always exactly 3 entries) — each entry's own
 * `todayAverageOverall`/`delta` being `undefined` (that specific agent has zero real `judge_results`
 * rows today) degrades ONLY that one card's score ring to an honest "belum ada skor" state, never
 * hiding the whole row or fabricating a 0.
 */
export function AgentStatusRow({
  agentStatus,
}: {
  readonly agentStatus: readonly OverviewAgentScoreDto[];
}): React.ReactElement {
  return (
    <div className={styles.row} data-testid="agent-status-row">
      {agentStatus.map((entry) => {
        const color = agentColorFor(entry.agent);
        return (
          <div
            key={entry.agent}
            className={styles.card}
            style={{ "--agent-color": color } as React.CSSProperties}
            data-testid={`agent-status-card-${entry.agent}`}
          >
            {entry.todayAverageOverall === undefined ? (
              <div className={styles.ringWrap}>
                <span className={styles.unavailable}>—</span>
              </div>
            ) : (
              <ScoreRing score={entry.todayAverageOverall} color={color} />
            )}
            <div>
              <p className={styles.name}>{AGENT_LABEL[entry.agent]}</p>
              <p className={styles.actionsToday}>{entry.actionsToday} aksi hari ini</p>
              <div className={styles.stats}>
                {entry.todayAverageOverall === undefined ? (
                  <span className={styles.unavailable}>Belum ada skor AI Judge hari ini</span>
                ) : (
                  <span className={styles.statLine}>
                    {entry.todaySampleSize} penilaian hari ini
                    {entry.delta !== undefined
                      ? ` · ${entry.delta >= 0 ? "+" : ""}${entry.delta.toFixed(1)} vs minggu lalu`
                      : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
