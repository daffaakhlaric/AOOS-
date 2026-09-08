"use client";

import { useState } from "react";

import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatIdr } from "@/lib/formatters";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

import { aggregateCampaign, computeCpl } from "./campaignInsightMath";
import styles from "./VerdictCards.module.css";

export interface VerdictCardsProps {
  readonly campaigns: readonly CampaignSummaryDto[];
  readonly onApply: (campaignId: string, verdict: string) => void;
}

/** Highest-priority-first, matching `CampaignTree.tsx`'s own real `VerdictEngine` precedence — actionable verdicts only (KEEP means "nothing to do", so it is never shown here). */
const ACTIONABLE_PRIORITY = ["FIX", "PAUSE", "SCALE", "REFRESH"] as const;
const MAX_CARDS = 4;

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — bottom-strip "Verdict cards" (spec: "real pending verdicts/actions
 * dengan Terapkan/Lewati buttons").
 *
 * REAL DATA vs. the spec's assumption: investigated this app's TWO real, DIFFERENT "approval gate"
 * concepts before wiring this — `PendingActionsService.approve`/`.reject` is the human-approval
 * gate for exactly one real `action_type` (`CREATE_PROPERTY_CAMPAIGN`, new-campaign proposals in
 * `APPROVAL` operating mode), a genuinely different concept from a per-campaign SCALE/PAUSE/FIX
 * optimization verdict. The real, matching mechanism for THIS card (an existing campaign's own
 * verdict) is the one `CampaignTree`'s "⚡ Execute" button already uses: `POST /api/verdicts` →
 * `aaos-api`'s `executeVerdict` (direct DEV-simulate/LIVE-execute, no separate PENDING row for this
 * action type). "Terapkan" here calls that SAME real mechanism (`onApply`, wired by the parent page
 * to the same handler `CampaignTree`'s onExecute already uses) — not a fabricated second execution
 * path.
 *
 * "Lewati" (skip): no real server-side "dismiss this verdict" endpoint exists for this direct-
 * execution flow (unlike `PendingActionsService.reject`, which only applies to the OTHER, unrelated
 * `CREATE_PROPERTY_CAMPAIGN` gate) — this is a real, honest, LOCAL-ONLY dismiss (hides the card for
 * this page session), not a fabricated backend call. Documented here rather than silently pretended
 * to be a persisted decision.
 */
export function VerdictCards({ campaigns, onApply }: VerdictCardsProps): React.ReactElement {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const candidates = campaigns
    .map((campaign) => ({
      campaign,
      verdict: aggregateVerdict(
        campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.verdict)),
      ),
    }))
    .filter(
      (entry) =>
        (ACTIONABLE_PRIORITY as readonly string[]).includes(entry.verdict) &&
        !dismissed.has(entry.campaign.id),
    )
    .sort(
      (a, b) =>
        ACTIONABLE_PRIORITY.indexOf(a.verdict as never) -
        ACTIONABLE_PRIORITY.indexOf(b.verdict as never),
    )
    .slice(0, MAX_CARDS);

  function handleSkip(campaignId: string): void {
    setDismissed((prev) => new Set(prev).add(campaignId));
  }

  return (
    <section data-testid="verdict-cards" className={styles.section}>
      <h3 className={styles.title}>Verdict</h3>
      {candidates.length === 0 ? (
        <EmptyState
          title="Tidak ada verdict aksi saat ini"
          description="Semua campaign KEEP/REVIEW — belum ada yang butuh aksi."
        />
      ) : (
        <ul className={styles.list}>
          {candidates.map(({ campaign, verdict }) => {
            const aggregate = aggregateCampaign(campaign);
            const cpl = computeCpl(aggregate.spend, aggregate.totalLead);
            return (
              <li
                key={campaign.id}
                data-testid={`verdict-card-${campaign.id}`}
                className={styles.card}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.campaignName}>{campaign.name}</span>
                  <VerdictBadge verdict={verdict} />
                </div>
                <p className={styles.cardMeta}>
                  {formatIdr(aggregate.spend)} spend · {cpl !== null ? formatIdr(cpl) : "—"} CPL
                </p>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    data-testid={`verdict-apply-${campaign.id}`}
                    onClick={() => onApply(campaign.id, verdict)}
                    className={styles.applyButton}
                  >
                    Terapkan
                  </button>
                  <button
                    type="button"
                    data-testid={`verdict-skip-${campaign.id}`}
                    onClick={() => handleSkip(campaign.id)}
                    className={styles.skipButton}
                  >
                    Lewati
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default VerdictCards;
