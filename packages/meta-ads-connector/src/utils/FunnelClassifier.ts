import { Funnel } from "../domain/value-objects/Funnel.js";

/**
 * Classifies a campaign name into a `Funnel`, per the spec's exact substring rules, checked in
 * the exact order given (first match wins — the spec lists rules as an ordered if/else chain,
 * not a set of mutually exclusive patterns, so a name matching multiple rules, e.g. containing
 * both "CTWA" and "Boost", resolves to the first-listed rule: CTWA):
 *
 *   1. contains "CTWA"               → CTWA
 *   2. contains "DM" or "Engagement" → DM
 *   3. contains "Website"            → WEBSITE_LEAD
 *   4. contains "Boost" or "Post:"   → BRAND_BOOST
 *   5. otherwise                     → BRAND_BOOST
 *
 * All substring checks are case-sensitive and literal, exactly as written in the spec (e.g.
 * "dm" lowercase does NOT match rule 2) — unlike `BranchExtractor`, the spec gives no
 * case-insensitive variants for any Funnel rule, so none are added here.
 */
export function classifyFunnel(campaignName: string): Funnel {
  if (campaignName.includes("CTWA")) {
    return Funnel.CTWA;
  }
  if (campaignName.includes("DM") || campaignName.includes("Engagement")) {
    return Funnel.DM;
  }
  if (campaignName.includes("Website")) {
    return Funnel.WEBSITE_LEAD;
  }
  return Funnel.BRAND_BOOST;
}
