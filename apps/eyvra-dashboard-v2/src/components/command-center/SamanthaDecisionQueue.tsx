"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import type { CampaignHealthSummaryEntryDto } from "@/types/dashboard.types";

import { SamanthaDecisionCard } from "./SamanthaDecisionCard";
import styles from "./SamanthaDecisionQueue.module.css";
import type { DecisionQueueState } from "./useDecisionQueue";

const NON_ACTIONABLE_DECISIONS = new Set(["NO_ACTION", "MONITOR"]);

type TabId = "ALL" | "CRITICAL" | "ACTION_REQUIRED" | "OPPORTUNITIES" | "MONITORING";

const MAX_ROWS_PER_TAB = 6;

/**
 * Every real filter predicate behind a tab's `(n)` count — unchanged from this component's original
 * wiring (no predicate was loosened or invented for the design pass). Each one runs over the real
 * `GET /api/campaign-health/account-summary` campaigns array, so a count is always a real number of
 * real campaigns, never a design-reference placeholder.
 */
function filterForTab(
  tab: TabId,
  campaigns: readonly CampaignHealthSummaryEntryDto[],
): readonly CampaignHealthSummaryEntryDto[] {
  switch (tab) {
    case "CRITICAL":
      return campaigns.filter((c) => c.decision.impact === "CRITICAL");
    case "ACTION_REQUIRED":
      return campaigns.filter(
        (c) =>
          !NON_ACTIONABLE_DECISIONS.has(c.decision.decision) &&
          c.decision.impact !== "CRITICAL" &&
          (c.decision.impact === "HIGH" || c.decision.impact === "MEDIUM"),
      );
    case "OPPORTUNITIES":
      return campaigns.filter((c) => c.decision.decision === "SCALE");
    case "MONITORING":
      return campaigns.filter((c) => c.decision.decision === "MONITOR");
    case "ALL":
    default:
      return campaigns;
  }
}

/**
 * The per-tab tint the ACTIVE pill carries (reference design: red-on-pink for `Critical`), plus the
 * small leading icon only the active pill shows. Purely presentational — each tone maps to the
 * semantic meaning of that tab's own real predicate above.
 */
const TAB_TONE: Record<TabId, string> = {
  ALL: "brand",
  CRITICAL: "critical",
  ACTION_REQUIRED: "warning",
  OPPORTUNITIES: "success",
  MONITORING: "brand",
};

/** 16px stroke glyphs, one per tab, rendered ONLY on the active pill (reference design). */
function TabIcon({ tab }: { readonly tab: TabId }): React.ReactElement {
  const path =
    tab === "CRITICAL"
      ? "M12 4.5 2.8 20h18.4L12 4.5Zm0 5.2v4.6m0 2.6h.01"
      : tab === "ACTION_REQUIRED"
        ? "M12 3v9m0 0 3.5-3.5M12 12 8.5 8.5M4 17v3h16v-3"
        : tab === "OPPORTUNITIES"
          ? "M4 18 10 11l3.5 3.5L20 6m0 0h-4.5m4.5 0v4.5"
          : tab === "MONITORING"
            ? "M3 12h4l2.5-6 3 12 2.5-6h6"
            : "M4 6h16M4 12h16M4 18h10";
  return (
    <svg className={styles.tabIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TAB_LABEL: Record<TabId, string> = {
  ALL: "All",
  CRITICAL: "Critical",
  ACTION_REQUIRED: "Action Required",
  OPPORTUNITIES: "Opportunities",
  MONITORING: "Monitoring",
};

const TAB_ORDER: readonly TabId[] = [
  "ALL",
  "CRITICAL",
  "ACTION_REQUIRED",
  "OPPORTUNITIES",
  "MONITORING",
];

export function SamanthaDecisionQueue({
  queue,
  campaigns,
  error,
}: {
  readonly queue: DecisionQueueState;
  readonly campaigns: readonly CampaignHealthSummaryEntryDto[];
  readonly error?: string;
}): React.ReactElement {
  const [tab, setTab] = useState<TabId>("ALL");

  const counts = useMemo<Record<TabId, number>>(
    () => ({
      ALL: queue.actionableCount,
      CRITICAL: filterForTab("CRITICAL", campaigns).length,
      ACTION_REQUIRED: filterForTab("ACTION_REQUIRED", campaigns).length,
      OPPORTUNITIES: filterForTab("OPPORTUNITIES", campaigns).length,
      MONITORING: filterForTab("MONITORING", campaigns).length,
    }),
    [queue.actionableCount, campaigns],
  );

  if (error !== undefined) {
    return <ErrorState message={error} />;
  }

  if (queue.entries === undefined) {
    return <LoadingState processLabel="Samantha sedang mendiagnosis campaign prioritas..." />;
  }

  const visible: readonly CampaignHealthSummaryEntryDto[] =
    tab === "ALL" ? queue.entries : filterForTab(tab, campaigns).slice(0, MAX_ROWS_PER_TAB);

  return (
    <div>
      <div className={styles.tabs} role="tablist" aria-label="Filter Decision Queue">
        {TAB_ORDER.map((tabId) => {
          const active = tab === tabId;
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.tab} ${active ? `${styles.tabActive} ${styles[`tone_${TAB_TONE[tabId]}`]}` : ""}`}
              onClick={() => setTab(tabId)}
              data-testid={`decision-tab-${tabId}`}
            >
              {active ? <TabIcon tab={tabId} /> : null}
              {/* The count lives INSIDE the label (reference design), and is always a real count
                  from that tab's own real predicate in `filterForTab`. */}
              {`${TAB_LABEL[tabId]} (${String(counts[tabId])})`}
            </button>
          );
        })}
        {/* "Completed" — no real resolved/completed-decision concept exists anywhere in this
            codebase, so there is no honest count to put in the parentheses. Rendered visibly
            disabled with an honest tooltip rather than with a fabricated `(11)` like the reference
            mockup shows. */}
        <button
          type="button"
          className={`${styles.tab} ${styles.tabDisabled}`}
          disabled
          title="Completed decision history is not available yet: this codebase does not track resolved decisions, so there is no real count to show here."
          data-testid="decision-tab-COMPLETED"
        >
          Completed
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={
            tab === "ALL"
              ? "Tidak ada campaign yang butuh keputusan Samantha saat ini"
              : "Tidak ada campaign di tab ini"
          }
          description="Samantha akan meninjau ulang akun secara berkala."
          testId="decision-queue-empty"
        />
      ) : (
        <ul className={styles.queue} data-testid="cc-decision-queue">
          {visible.map((entry) => (
            <SamanthaDecisionCard key={entry.campaignId} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
