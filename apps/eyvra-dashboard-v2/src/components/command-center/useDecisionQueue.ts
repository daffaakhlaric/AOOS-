"use client";

import { useMemo } from "react";

import type {
  AccountSummaryResponseDto,
  CampaignHealthSummaryEntryDto,
} from "@/types/dashboard.types";

const IMPACT_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
const MAX_QUEUE_SIZE = 5;
/** A campaign whose real `decision.decision` is one of these 2 has nothing for Samantha to recommend — excluded from the Decision Queue, same set `diagnosis.rootCause` is real for (see `decideNextAction`'s own decision table). */
const NON_ACTIONABLE_DECISIONS = new Set(["NO_ACTION", "MONITOR"]);

export interface DecisionQueueState {
  /** `undefined` while the account summary is still loading. Real, ranked, capped at `MAX_QUEUE_SIZE` once loaded. */
  readonly entries?: readonly CampaignHealthSummaryEntryDto[];
  /** Real count of actionable campaigns account-wide, BEFORE the `MAX_QUEUE_SIZE` cap — lets the UI say "top 5 of N", never silently hides how many more exist. */
  readonly actionableCount: number;
}

/**
 * Real, account-wide Samantha Decision Queue selector (Command Center real-data-wiring fix) — a
 * pure client-side ranking over the already-fetched `GET /api/campaign-health/account-summary`
 * result (`useAccountSummary`), NOT a second fetch. Replaces the old `useDecisionQueue`, which used
 * to (a) pre-filter candidates by the LEGACY per-ad `Verdict` priority (FIX>PAUSE>SCALE>REFRESH)
 * and (b) fetch `campaign-health` for only those top-5 candidates, one HTTP call each. Now: EVERY
 * real active campaign already has its `{health,diagnosis,decision}` computed server-side in one
 * call, so this only needs to rank the real `decision.impact` (CRITICAL>HIGH>MEDIUM>LOW>UNKNOWN,
 * then `decision.confidence` descending) and slice the top `MAX_QUEUE_SIZE` — genuinely
 * account-wide highest-priority, not gated by any legacy verdict pre-filter.
 */
export function useDecisionQueue(
  summary: AccountSummaryResponseDto | undefined,
): DecisionQueueState {
  return useMemo(() => {
    if (summary === undefined) {
      return { entries: undefined, actionableCount: 0 };
    }

    const actionable = summary.campaigns.filter(
      (entry) => !NON_ACTIONABLE_DECISIONS.has(entry.decision.decision),
    );
    const ranked = [...actionable].sort((a, b) => {
      const impactDelta =
        (IMPACT_RANK[b.decision.impact] ?? 0) - (IMPACT_RANK[a.decision.impact] ?? 0);
      if (impactDelta !== 0) return impactDelta;
      return b.decision.confidence - a.decision.confidence;
    });

    return { entries: ranked.slice(0, MAX_QUEUE_SIZE), actionableCount: ranked.length };
  }, [summary]);
}
