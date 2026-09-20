/**
 * PROMPT 58 — DYNAMIC LAYOUT ENGINE.
 *
 * Real spec text (verbatim, master spec dump, transcript line ~65407):
 *   Pipeline:
 *     KIE VISUAL -> KAI QA -> LAYOUT ENGINE -> EXACT TEXT -> LOGO -> CTA -> FINAL AD
 *
 *   Layout families:
 *     HERO_FULL_BLEED, ASYMMETRIC_EDITORIAL, PRICE_DOMINANT, BOTTOM_INFO_BAR, FLOATING_CARD,
 *     SPLIT_SCREEN, MAP_HYBRID, EDITORIAL_LUXURY, SPEC_GRID, MORTGAGE_CARD, PROPERTY_DISCOVERY
 *
 *   "Do not use only rigid templates. Kai produces layout spec."
 *
 * This is a taxonomy/vocabulary definition, not a claim that every member has bespoke compositing
 * logic yet — the exact same discipline `ConceptFamily.ts` (PROMPT 44) documents for its own 20
 * members: a vocabulary costs nothing extra to be complete, but WHICH families have real, working
 * pixel-positioning logic is a separate, narrower question answered by
 * `creative-image-overlay.ts`'s own `IMPLEMENTED_LAYOUT_FAMILIES` (currently `BOTTOM_INFO_BAR` and
 * `HERO_FULL_BLEED` — see that file's doc for the honest fallback behavior of the other 9).
 *
 * Real overlap with `ConceptFamily` (PROMPT 44): 3 of these 11 names are VERBATIM, EXACT matches to
 * existing `ConceptFamily` members — `PRICE_DOMINANT`, `SPEC_GRID`, `MORTGAGE_CARD`. The spec itself
 * uses the same word for both a "visual/structural treatment" (concept family, HOW an ad expresses
 * an appeal) and a "layout family" (HOW elements are physically arranged on the canvas) in these 3
 * cases — genuinely the same real-world concept viewed from two adjacent pipeline stages, not a
 * coincidence to paper over with a rename. `ConceptFamilyToLayoutFamilyMapper.ts` deliberately reuses
 * `ConceptFamily` as its input rather than inventing a second, parallel taxonomy for the same idea —
 * see that mapper's own doc for the full one-to-one resolution across all 20 concept families.
 */
export enum LayoutFamily {
  HERO_FULL_BLEED = "HERO_FULL_BLEED",
  ASYMMETRIC_EDITORIAL = "ASYMMETRIC_EDITORIAL",
  PRICE_DOMINANT = "PRICE_DOMINANT",
  BOTTOM_INFO_BAR = "BOTTOM_INFO_BAR",
  FLOATING_CARD = "FLOATING_CARD",
  SPLIT_SCREEN = "SPLIT_SCREEN",
  MAP_HYBRID = "MAP_HYBRID",
  EDITORIAL_LUXURY = "EDITORIAL_LUXURY",
  SPEC_GRID = "SPEC_GRID",
  MORTGAGE_CARD = "MORTGAGE_CARD",
  PROPERTY_DISCOVERY = "PROPERTY_DISCOVERY",
}

/** All 11 members, in the spec's declared order. */
export const ALL_LAYOUT_FAMILIES: readonly LayoutFamily[] = [
  LayoutFamily.HERO_FULL_BLEED,
  LayoutFamily.ASYMMETRIC_EDITORIAL,
  LayoutFamily.PRICE_DOMINANT,
  LayoutFamily.BOTTOM_INFO_BAR,
  LayoutFamily.FLOATING_CARD,
  LayoutFamily.SPLIT_SCREEN,
  LayoutFamily.MAP_HYBRID,
  LayoutFamily.EDITORIAL_LUXURY,
  LayoutFamily.SPEC_GRID,
  LayoutFamily.MORTGAGE_CARD,
  LayoutFamily.PROPERTY_DISCOVERY,
];
