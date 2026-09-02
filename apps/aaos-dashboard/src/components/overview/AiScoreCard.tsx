import type { OverviewAgentScoreDto } from "@/types/dashboard.types";

import { agentColorFor } from "./agentColors";
import styles from "./AiScoreCard.module.css";

const AGENT_LABEL: Readonly<Record<OverviewAgentScoreDto["agent"], string>> = {
  SAMANTHA: "Samantha",
  KAI: "Kai",
  CLARA: "Clara",
};

/**
 * AI self-improve score card (spec "BAGIAN 7") — real per-agent `todayAverageOverall` progress bar
 * + `delta`. REAL FINDING correcting the pasted spec: it assumes a fixed per-agent `target` (75/70/
 * 65) that drives a "below target" warning banner — no such target concept exists anywhere in this
 * codebase's real `judge_results`/AI Judge tables (verified: `JudgeResultRepository` has no
 * `target`/threshold field). Rather than fabricate one, this card shows the real score + real delta
 * only, honestly omitting the spec's warning banner (a real, later addition once a real target
 * concept exists server-side).
 */
export function AiScoreCard({
  agentStatus,
}: {
  readonly agentStatus: readonly OverviewAgentScoreDto[];
}): React.ReactElement {
  return (
    <div data-testid="ai-score-card">
      {agentStatus.map((entry) => {
        const color = agentColorFor(entry.agent);
        return (
          <div key={entry.agent} className={styles.row}>
            <span className={styles.name} style={{ color }}>
              {AGENT_LABEL[entry.agent]}
            </span>
            {entry.todayAverageOverall === undefined ? (
              <span className={styles.unavailable}>Belum ada skor hari ini</span>
            ) : (
              <>
                <div className={styles.track}>
                  <div
                    className={styles.fill}
                    style={{
                      width: `${Math.min(Math.max(entry.todayAverageOverall, 0), 100)}%`,
                      background: color,
                    }}
                  />
                </div>
                <span className={styles.score} style={{ color }}>
                  {Math.round(entry.todayAverageOverall)}
                </span>
                <span
                  className={styles.delta}
                  style={{
                    color:
                      entry.delta !== undefined && entry.delta < 0 ? "var(--red)" : "var(--green)",
                  }}
                >
                  {entry.delta === undefined
                    ? "—"
                    : `${entry.delta >= 0 ? "+" : ""}${entry.delta.toFixed(1)}`}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
