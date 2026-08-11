import { Branch } from "../domain/value-objects/Branch.js";

/**
 * Extracts a `Branch` from a campaign/adset name, per the spec's exact rules, checked in the
 * order listed (first match wins):
 *
 *   contains "Cinere"           → CINERE
 *   contains "Bintaro"          → BINTARO
 *   contains "Bandung"          → BANDUNG
 *   contains "Boost"/"boost"    → BOOST   (spec gives both casings explicitly → case-insensitive)
 *   contains "multi"/"Multi"    → MULTI   (spec gives both casings explicitly → case-insensitive)
 *   otherwise                   → UMUM
 *
 * Judgment call: the spec writes "Cinere"/"Bintaro"/"Bandung" with only a single casing each,
 * while explicitly spelling out both casings for "Boost"/"boost" and "multi"/"Multi". Read
 * literally, that's a real, deliberate asymmetry (city names are proper nouns creative teams
 * consistently capitalize in campaign naming; "boost"/"multi" are common words that appear in
 * both title-case and lowercase campaign-naming conventions) — so this implementation matches
 * the city names case-*sensitively*, exactly as written, and matches "Boost"/"boost" and
 * "multi"/"Multi" case-*insensitively*, exactly as written. This is chosen over a blanket
 * case-insensitive match for every rule (which would also match "cinere", "BANDUNG", etc. with no
 * textual basis in the spec) since it produces the smallest deviation from the literal rule text.
 */
export function extractBranch(campaignOrAdSetName: string): Branch {
  if (campaignOrAdSetName.includes("Cinere")) {
    return Branch.CINERE;
  }
  if (campaignOrAdSetName.includes("Bintaro")) {
    return Branch.BINTARO;
  }
  if (campaignOrAdSetName.includes("Bandung")) {
    return Branch.BANDUNG;
  }
  const lower = campaignOrAdSetName.toLowerCase();
  if (lower.includes("boost")) {
    return Branch.BOOST;
  }
  if (lower.includes("multi")) {
    return Branch.MULTI;
  }
  return Branch.UMUM;
}
