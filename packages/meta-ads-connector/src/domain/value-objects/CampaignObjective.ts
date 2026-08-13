/**
 * The Meta campaign objective, restricted to the subset AAOS understands and acts on.
 *
 * AAOS-W1D-S3: `OUTCOME_LEADS` is DSS Motor's real strategy objective — every campaign should
 * converge on it (CTWA: lead clicks the ad, lands straight in WhatsApp with Jessy). See
 * `VerdictEngine.ts`'s FIX check, which treats every OTHER member of this enum as needing a fix,
 * derived off this member rather than a hardcoded list — so adding a future objective here never
 * silently exempts it from that check.
 */
export enum CampaignObjective {
  OUTCOME_LEADS = "OUTCOME_LEADS",
  OUTCOME_ENGAGEMENT = "OUTCOME_ENGAGEMENT",
  OUTCOME_SALES = "OUTCOME_SALES",
  LINK_CLICKS = "LINK_CLICKS",
  VISIT_INSTAGRAM_PROFILE = "VISIT_INSTAGRAM_PROFILE",
}
