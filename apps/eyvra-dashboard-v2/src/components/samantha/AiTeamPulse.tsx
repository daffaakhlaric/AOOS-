"use client";

import Link from "next/link";

import type { DecisionQueueState } from "@/components/command-center/useDecisionQueue";
import { formatNumber } from "@/lib/formatters";
import type { AccountSummaryResponseDto } from "@/types/dashboard.types";

import styles from "./AiTeamPulse.module.css";

/** A campaign whose real `decision.decision` is one of these 2 has nothing for Samantha to act on — same set `useDecisionQueue`/`NeedsAttentionSummary` already exclude. */
const NON_ACTIONABLE_DECISIONS = new Set(["NO_ACTION", "MONITOR"]);

/** Decorative audio-waveform glyph (top-right). Pure CSS bars, no data meaning whatsoever. */
const WAVEFORM_BAR_HEIGHTS = [8, 15, 22, 13, 19, 9, 14] as const;

/**
 * Builds the panel's one-sentence summary from REAL account-summary numbers only.
 *
 * Every clause is emitted only when its own real source exists: the critical-issue clause needs the
 * real `AccountSummaryResponseDto.campaigns` (counted the same way Needs Attention counts it — real
 * actionable campaigns whose real `decision.impact` is `CRITICAL`), the scaling clause needs the
 * real `opportunities` array. When the account summary has not loaded (or failed) we fall back to
 * the one real number that IS available — `decisionQueue.actionableCount` — and when even that is
 * unavailable we say so honestly instead of inventing a sentence.
 */
function buildSummarySentence(
  summary: AccountSummaryResponseDto | undefined,
  decisionQueue: DecisionQueueState,
): string {
  if (summary !== undefined) {
    const actionable = summary.campaigns.filter(
      (entry) => !NON_ACTIONABLE_DECISIONS.has(entry.decision.decision),
    );
    const criticalCount = actionable.filter((entry) => entry.decision.impact === "CRITICAL").length;
    const opportunityCount = summary.opportunities.length;
    const clauses = [
      `${formatNumber(criticalCount)} critical ${criticalCount === 1 ? "issue" : "issues"}`,
      `${formatNumber(opportunityCount)} scaling ${opportunityCount === 1 ? "opportunity" : "opportunities"}`,
    ];
    return `Samantha found ${clauses.join(" and ")} in the latest assessment.`;
  }

  if (decisionQueue.entries !== undefined) {
    const count = decisionQueue.actionableCount;
    return `Samantha has ${formatNumber(count)} ${count === 1 ? "decision" : "decisions"} waiting for review.`;
  }

  return "Samantha's account assessment is not available yet.";
}

/**
 * "Your AI Team is Working" — the ONE place in the Command Center a strong brand-purple surface is
 * allowed (per the user's own design reference); every other card stays white/subtle. Occupies the
 * 3-of-12 slot beside the KPI strip and is height-matched to it.
 *
 * Deliberately a single compact panel — never giant per-agent Samantha/Kai/Clara cards. Per-agent
 * production/lead detail already lives in its own real card (Kai Creative Production) and page, so
 * this panel carries one real headline sentence plus the link to the full report instead of
 * duplicating (and re-fetching) those numbers here.
 */
export function AiTeamPulse({
  summary,
  decisionQueue,
}: {
  readonly summary?: AccountSummaryResponseDto;
  readonly decisionQueue: DecisionQueueState;
}): React.ReactElement {
  const sentence = buildSummarySentence(summary, decisionQueue);

  return (
    <div className={styles.card} data-testid="cc-ai-team-pulse">
      <span className={styles.waveform} aria-hidden="true">
        {WAVEFORM_BAR_HEIGHTS.map((height, index) => (
          <span
            key={index}
            className={styles.waveformBar}
            style={{ height: `${String(height)}px` }}
          />
        ))}
      </span>
      <p className={styles.header}>Your AI Team is Working</p>
      <p className={styles.summary} data-testid="cc-ai-team-pulse-summary">
        {sentence}
      </p>
      <Link href="/activity" className={styles.reportButton}>
        View Full Report →
      </Link>
    </div>
  );
}
