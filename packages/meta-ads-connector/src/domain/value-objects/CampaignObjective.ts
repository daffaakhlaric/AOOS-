/**
 * The Meta campaign objective. Covers every ODAX (Outcome-Driven Ad Experiences) objective Meta
 * currently issues, plus the pre-ODAX legacy values AAOS has actually seen on DSS Motor's ad
 * account, plus `UNKNOWN` for whatever Meta adds next.
 *
 * AAOS-W1D-S3: `OUTCOME_LEADS` is DSS Motor's real strategy objective — every campaign should
 * converge on it (CTWA: lead clicks the ad, lands straight in WhatsApp with Jessy). See
 * `VerdictEngine.ts`'s FIX check, which treats every OTHER member of this enum (including
 * `UNKNOWN`) as needing a fix, derived off this member rather than a hardcoded list — so adding a
 * future objective here never silently exempts it from that check.
 *
 * `UNKNOWN` (real bug fix, see `parseCampaignObjective` below): Meta's ODAX objective list is not
 * closed — `mapCampaign` used to `err()` the *entire* campaign-list mapping the moment it saw one
 * objective outside this enum (e.g. `OUTCOME_APP_PROMOTION`), which took down the whole ad
 * account's sync over a single campaign AAOS doesn't act on. `UNKNOWN` lets that one campaign map
 * successfully — and, since it isn't `OUTCOME_LEADS`, `VerdictEngine` still correctly flags it
 * `FIX` — without aborting every other campaign in the same response.
 */
export enum CampaignObjective {
  OUTCOME_LEADS = "OUTCOME_LEADS",
  OUTCOME_ENGAGEMENT = "OUTCOME_ENGAGEMENT",
  OUTCOME_SALES = "OUTCOME_SALES",
  OUTCOME_AWARENESS = "OUTCOME_AWARENESS",
  OUTCOME_TRAFFIC = "OUTCOME_TRAFFIC",
  OUTCOME_APP_PROMOTION = "OUTCOME_APP_PROMOTION",
  LINK_CLICKS = "LINK_CLICKS",
  VISIT_INSTAGRAM_PROFILE = "VISIT_INSTAGRAM_PROFILE",
  /** Any Meta objective string not otherwise a member of this enum — see `parseCampaignObjective`. */
  UNKNOWN = "UNKNOWN",
}

const KNOWN_OBJECTIVES: ReadonlySet<string> = new Set(
  Object.values(CampaignObjective).filter((value) => value !== CampaignObjective.UNKNOWN),
);

/**
 * Parses a raw Meta `objective` string into `CampaignObjective`, never failing — an objective
 * Meta returns that isn't one of the members above (a new ODAX objective, an account-level
 * experiment, ...) maps to `UNKNOWN` rather than rejecting the campaign. `UNKNOWN` still isn't
 * `OUTCOME_LEADS`, so `VerdictEngine.evaluateVerdict` still correctly returns `FIX` for it —
 * nothing is silently masked, the campaign just isn't dropped from the sync over it.
 */
export function parseCampaignObjective(raw: string): CampaignObjective {
  if (KNOWN_OBJECTIVES.has(raw)) {
    return raw as CampaignObjective;
  }
  return CampaignObjective.UNKNOWN;
}
