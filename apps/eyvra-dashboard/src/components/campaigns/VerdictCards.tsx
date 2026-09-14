"use client";

import { useEffect, useState } from "react";

import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr } from "@/lib/formatters";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

import { aggregateCampaign, computeCpl } from "./campaignInsightMath";
import styles from "./VerdictCards.module.css";

export interface VerdictCardsProps {
  readonly campaigns: readonly CampaignSummaryDto[];
  readonly onApply: (campaignId: string, verdict: string) => void;
  /**
   * SPRINT 4 FIX: `CampaignsHubClient`'s own `useCampaignsSnapshot().loading` — already the real
   * signal that a `pull()` (including the one `handleApplyVerdict` triggers right after its
   * `POST /api/verdicts`, see that function's own `.then(() => pull(datePreset))`) is in flight.
   * Reused here verbatim (no new parallel loading mechanism) so "Terapkan" gives real, honest
   * pending feedback instead of sitting inert until the whole page re-renders with fresh data —
   * see this component's own doc for the full real bug this fixes.
   */
  readonly loading?: boolean;
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
 *
 * SAMANTHA ADVANCED SPRINT 4 audit (two real, confirmed bugs fixed, one hypothesis RULED OUT):
 *
 * 1. RULED OUT — no spend/CPL derivation divergence vs. `UnifiedCampaignTable.tsx`: both components
 *    call the exact same pure `aggregateCampaign`/`computeCpl` (`campaignInsightMath.ts`) on the
 *    exact same `campaign` object instances (`CampaignsHubClient.tsx` passes the identical
 *    `filteredCampaigns` array to both `<UnifiedCampaignTable>` and `<VerdictCards>`). There is no
 *    code path here where this card's own `spend`/`cpl` can differ from the table's row for the
 *    same campaign — if the table shows real non-zero spend, this card necessarily does too. A
 *    lingering "Rp 0 spend · — CPL" report is therefore either (a) the already-fixed stale-cache/
 *    rate-limit-reject issue from earlier this session, or (b) a genuinely zero-spend campaign for
 *    the selected date range — not a bug in this file's own math.
 *
 * 2. REAL BUG (confirmed) — this card rendered the campaign's RAW `campaign.name`, never
 *    `stripAdNameSuffix`-cleaned, while `UnifiedCampaignTable.tsx` already applies
 *    `stripAdNameSuffix(campaign.name)` per that helper's own docstring ("Applied to every level's
 *    display name (campaign/ad-set/ad — FIX 1)"). This card was the one level FIX 1 missed —
 *    explains ad/creative-suffix-looking names (e.g. "...CTWA 280126"-style) surviving intact on
 *    this card while the table above it shows the cleaned name for the identical campaign. Fixed
 *    below by reusing the same real helper, never a second parallel name-cleaning function.
 *
 * 3. REAL BUG (confirmed) — "Terapkan" gave NO pending/disabled feedback: `onApply` fires a
 *    fire-and-forget `POST /api/verdicts` followed by `.then(() => pull(datePreset))`
 *    (`CampaignsHubClient.handleApplyVerdict`), and `pull()` can take a real couple of seconds
 *    against Meta — but this card's button stayed fully interactive and unchanged the entire time,
 *    genuinely reading as "static" exactly as reported, independent of whether the underlying data
 *    eventually refreshes correctly. Fixed by reusing the SAME real `loading` flag
 *    `useCampaignsSnapshot()` already exposes (and `CampaignsHubClient`'s own "Tarik Data Baru"
 *    button already disables on) — no new parallel loading state invented.
 *
 * DEEPER FINDING, NOW RESOLVED (was documented-not-fixed in the prior audit; product decision made):
 *    `CampaignSummaryDto.spend` (`campaign.spend`, used by `BudgetTracker.tsx`) and this card's own
 *    `aggregateCampaign(campaign).spend` (sum of `ad.metrics.spend`) are confirmed, via
 *    `apps/aaos-api/.../campaign-response.dto.ts` + `packages/meta-ads-connector/src/mappers/
 *    CampaignMapper.ts`, to be TWO INDEPENDENTLY-PULLED Meta numbers — `campaign.spend` comes from a
 *    real, separate campaign-level Insights row (`insightRow.spend`), never a sum of this same
 *    account's ad-level Insights rows. They should normally agree, but a delayed/partial ad-level
 *    Insights pull for one campaign (while its campaign-level Insights succeeds) makes this card +
 *    `UnifiedCampaignTable.tsx` (which uses the SAME `aggregateCampaign`) show a misleading `Rp 0`
 *    while `BudgetTracker.tsx`, right next to this card in the same bottom strip, shows the real
 *    non-zero `campaign.spend` for the identical campaign — a live-confirmed report, not a theory.
 *    FIX: when `aggregateCampaign(campaign).spend` is 0 but `campaign.spend` is real/non-zero, this
 *    card now shows the real `campaign.spend` instead of a fabricated-looking `Rp 0`, with CPL
 *    honestly `"—"` (never dividing `campaign.spend` by an ad-level `totalLead` count that has no
 *    real relationship to it — the exact decoupling risk the prior audit flagged). A caption makes
 *    the degrade visible rather than silent, matching `BudgetTracker.tsx`'s own honest-degrade
 *    precedent for "the finer-grained number isn't available yet, here's the real coarser one".
 */
export function VerdictCards({
  campaigns,
  onApply,
  loading = false,
}: VerdictCardsProps): React.ReactElement {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | undefined>(undefined);

  // Real bug fix #3 (see doc above): once the page-wide `pull()` this Terapkan click triggered
  // finishes (`loading` flips back to `false`), clear the pending marker so a LATER click on the
  // same or a different card starts a fresh, honest pending state rather than one stuck from a
  // previous action.
  useEffect(() => {
    if (!loading) {
      setPendingId(undefined);
    }
  }, [loading]);

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
            // Real bug fix (see this component's own "DEEPER FINDING, NOW RESOLVED" doc above): the
            // ad-level rollup can legitimately be a delayed-pull Rp 0 while the campaign-level Meta
            // Insights row (`campaign.spend`) already has the real number — show that real number
            // instead of a misleading Rp 0, and never pair it with a CPL it has no real relationship to.
            const adLevelSpendAvailable = aggregate.spend > 0;
            const displaySpend = adLevelSpendAvailable ? aggregate.spend : campaign.spend;
            const cpl = adLevelSpendAvailable
              ? computeCpl(aggregate.spend, aggregate.totalLead)
              : null;
            return (
              <li
                key={campaign.id}
                data-testid={`verdict-card-${campaign.id}`}
                className={styles.card}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.campaignName}>{stripAdNameSuffix(campaign.name)}</span>
                  <VerdictBadge verdict={verdict} />
                </div>
                <p className={styles.cardMeta} data-testid={`verdict-meta-${campaign.id}`}>
                  {formatIdr(displaySpend)} spend · {cpl !== null ? formatIdr(cpl) : "—"} CPL
                  {!adLevelSpendAvailable && displaySpend > 0 ? (
                    <span
                      className={styles.degradeNote}
                      data-testid={`verdict-degrade-note-${campaign.id}`}
                    >
                      {" "}
                      (breakdown per-iklan belum tersedia, ini spend campaign)
                    </span>
                  ) : null}
                </p>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    data-testid={`verdict-apply-${campaign.id}`}
                    onClick={() => {
                      setPendingId(campaign.id);
                      onApply(campaign.id, verdict);
                    }}
                    disabled={loading}
                    className={styles.applyButton}
                  >
                    {loading && pendingId === campaign.id ? "Menerapkan…" : "Terapkan"}
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
