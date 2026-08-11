/**
 * The marketing funnel a campaign belongs to, classified by `utils/FunnelClassifier.ts`.
 *
 * Judgment call: the spec's domain-model comment names the fourth member "Brand", but its
 * Funnel Classification rules literally produce `Funnel.BRAND_BOOST` (both for names
 * containing "Boost"/"Post:" and as the final "otherwise" fallback). `BRAND_BOOST` is used
 * here, matching the explicit classification rules over the informal domain-model shorthand.
 */
export enum Funnel {
  CTWA = "CTWA",
  DM = "DM",
  WEBSITE_LEAD = "WEBSITE_LEAD",
  BRAND_BOOST = "BRAND_BOOST",
}
