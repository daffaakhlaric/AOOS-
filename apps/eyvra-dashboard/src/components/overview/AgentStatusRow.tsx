import type { OverviewAgentScoreDto } from "@/types/dashboard.types";

import { agentColorFor, AGENT_GRADIENT } from "./agentColors";
import styles from "./AgentStatusRow.module.css";

const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AGENT_LABEL: Readonly<Record<OverviewAgentScoreDto["agent"], string>> = {
  SAMANTHA: "Samantha",
  KAI: "Kai",
  CLARA: "Clara",
};

/** Score ring rendered ON the gradient header — white per spec Prompt 4 ("Score ring putih di header"), track a translucent white rather than `var(--gray-200)` so it reads against every agent's gradient color. */
function ScoreRing({ score }: { readonly score: number }): React.ReactElement {
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
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r={RING_RADIUS}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={styles.ringLabel}>{Math.round(score)}</span>
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
 *
 * COLORFUL BRAND GUIDELINE V2 (Phase B3, Prompt 4): restructured from a flat row (ring + text) into
 * a full gradient header (agent name + white score ring) over a plain white body (actions/stats),
 * using `agentColors.ts`'s corrected `AGENT_GRADIENT` (see that file's own doc for the real
 * KAI/CLARA hex-mismatch finding + fix). No `LIVE`/`SIMULATED` status badge from Prompt 4's mockup
 * is rendered — `OverviewAgentScoreDto` (`src/types/dashboard.types.ts`) has no `status` field for
 * any real per-agent "live/simulated" concept, so adding one would be a fabricated value with no
 * real backing data (same discipline as this file's existing `todayAverageOverall === undefined`
 * handling below).
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
        const gradient = AGENT_GRADIENT[entry.agent];
        return (
          <div
            key={entry.agent}
            className={styles.card}
            style={{ "--agent-color": color } as React.CSSProperties}
            data-testid={`agent-status-card-${entry.agent}`}
          >
            <div className={styles.header} style={{ background: gradient }}>
              <div>
                <p className={styles.name}>{AGENT_LABEL[entry.agent]}</p>
              </div>
              {entry.todayAverageOverall === undefined ? (
                <div className={styles.ringWrap}>
                  <span className={styles.unavailableRing}>—</span>
                </div>
              ) : (
                <ScoreRing score={entry.todayAverageOverall} />
              )}
            </div>
            <div className={styles.body}>
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
