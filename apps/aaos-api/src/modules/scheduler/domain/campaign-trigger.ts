/**
 * `shouldCreateNewCampaign` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase C point 3) — PROPERTY-only
 * campaign-creation trigger logic, wired into `SchedulerService.runSamanthaAnalyze`/
 * `runKaiRefreshCheck` (Phase C point 4). Pure, synchronous, no I/O — same "pure decision function
 * over already-computed signals" shape `resolveCalendarRange`/`nextOccurrence` in
 * `scheduler.service.ts` and `VerdictDecisionEngine` in `@aos/meta-ads-agent` already establish, so
 * it is trivially unit-testable without mocking anything.
 *
 * Implements 4 of the design doc's 5 real trigger conditions. Condition 5
 * (`ads_get_opportunity_score` / "Meta opportunity score") is DELIBERATELY DROPPED — confirmed
 * fictional earlier this session: no such Meta Marketing API tool/endpoint exists, this exact
 * hallucination was already caught and removed from 2 other pasted specs this session. No
 * substitute real Meta Ads Insights signal was found via research either, so this function simply
 * implements conditions 1-4, never a fabricated 5th.
 */

/** One listing's real, already-computed campaign-matching signals for this pull cycle. */
export interface ListingCampaignSignals {
  readonly listingId: string;
  readonly listingCreatedAt: Date;
  /** Whether any real, currently-`ACTIVE` Meta campaign was matched to this listing this pull. */
  readonly hasActiveCampaign: boolean;
  /** Highest real `frequency` among ads matched to this listing's active campaign, if any. */
  readonly maxFrequency?: number;
  /** Real cost-per-lead (IDR) for this listing's active campaign this pull, if computable (spend / totalLead, both > 0). */
  readonly cplIDR?: number;
  /** Real benchmark CPL (IDR) to compare against — this tenant's own average CPL across every other listing with a computable CPL this same pull (no external/fabricated benchmark). */
  readonly benchmarkCplIDR?: number;
}

export type CampaignTriggerReason =
  /** No listing ever had an active campaign matched, and the listing is no longer "new" (past `NEW_LISTING_WINDOW_MS`) — an established listing sitting with no live campaign. */
  | "NO_ACTIVE_CAMPAIGN"
  /** A brand-new listing (within `NEW_LISTING_WINDOW_MS` of creation) with no active campaign yet — needs its first campaign. */
  | "NEW_LISTING_WITHOUT_CAMPAIGN"
  /** The matched active campaign's ad frequency has crossed the fatigue threshold. */
  | "HIGH_FREQUENCY"
  /** The matched active campaign's CPL is significantly above this tenant's own benchmark CPL. */
  | "HIGH_CPL";

export interface CampaignTriggerDecision {
  readonly shouldCreate: boolean;
  readonly reasons: readonly CampaignTriggerReason[];
}

/** 48 hours — a listing created within this window with no active campaign is "new", not "abandoned". Not a spec-given number (the design doc names the condition, not a numeric window); a documented judgment call, same "initial default pending business review" discipline `PropertyBranchAudienceDefaults.ts` uses for its own numbers. */
export const NEW_LISTING_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Reused verbatim from `@aos/meta-ads-agent`'s real, already-established `FATIGUE_FREQUENCY_THRESHOLD`/`FREQUENCY_HIGH_MEDIUM_THRESHOLD` constant (`HistoricalLearningService.ts`/`AnomalyDetector.ts`) — not a fresh, independently-chosen number. */
export const HIGH_FREQUENCY_THRESHOLD = 3.5;

/** CPL more than 50% above this tenant's own benchmark counts as "high" — a documented judgment call (no external CPL-anomaly threshold exists anywhere in this codebase to reuse), deliberately conservative (not 10-20%) so ordinary day-to-day CPL noise doesn't fire a trigger every pull. */
export const HIGH_CPL_MULTIPLIER = 1.5;

/**
 * Conditions 1/2 are mutually exclusive by construction (both require `!hasActiveCampaign`, split
 * by listing age against `NEW_LISTING_WINDOW_MS`) so each is independently, deterministically
 * testable. Conditions 3/4 are independent of 1/2 and of each other — any subset (including none)
 * may fire together.
 */
export function shouldCreateNewCampaign(
  signals: ListingCampaignSignals,
  now: Date,
): CampaignTriggerDecision {
  const reasons: CampaignTriggerReason[] = [];

  if (!signals.hasActiveCampaign) {
    const ageMs = now.getTime() - signals.listingCreatedAt.getTime();
    reasons.push(
      ageMs <= NEW_LISTING_WINDOW_MS ? "NEW_LISTING_WITHOUT_CAMPAIGN" : "NO_ACTIVE_CAMPAIGN",
    );
  }

  if (signals.maxFrequency !== undefined && signals.maxFrequency > HIGH_FREQUENCY_THRESHOLD) {
    reasons.push("HIGH_FREQUENCY");
  }

  if (
    signals.cplIDR !== undefined &&
    signals.benchmarkCplIDR !== undefined &&
    signals.benchmarkCplIDR > 0 &&
    signals.cplIDR > signals.benchmarkCplIDR * HIGH_CPL_MULTIPLIER
  ) {
    reasons.push("HIGH_CPL");
  }

  return { shouldCreate: reasons.length > 0, reasons };
}
