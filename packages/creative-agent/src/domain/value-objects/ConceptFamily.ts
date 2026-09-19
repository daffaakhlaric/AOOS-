/**
 * PROMPT 44 — KAI CONCEPT ENGINE.
 *
 * Real spec text (verbatim, master spec dump, transcript line ~65407):
 *   Concept families:
 *     PRICE_DOMINANT, MORTGAGE_CARD, LOCATION_MAP, LOCATION_COMMUTE, PREMIUM_EDITORIAL,
 *     FAMILY_LIFESTYLE, PROPERTY_FEATURE, SPEC_GRID, INVESTOR_DATA, POV_TOUR, UGC_DISCOVERY,
 *     PROBLEM_SOLUTION, CURIOSITY_REVEAL, CAROUSEL_DISCOVERY, ARCHITECTURAL_DETAIL, SOCIAL_NATIVE,
 *     PROPERTY_COMPARISON, SCARCITY_DIRECT, FLOORPLAN_STORY, NEIGHBORHOOD_STORY
 *   Extensible registry.
 *
 * This is a taxonomy/vocabulary definition, not a claim that every member has bespoke downstream
 * behavior yet. All 20 real spec names are included verbatim (nothing invented, nothing renamed)
 * because a vocabulary costs nothing extra to be complete — unlike `PropertyIntegrityMode.ts`
 * (PROMPT 46), which deliberately narrowed to 2 of 3 modes because the THIRD mode (`ENHANCE`)
 * would have required guessing at an honest mapping from an unstructured field. There is no such
 * problem here: this file is only naming real concept categories, not deciding when each applies —
 * that deterministic decision lives in `intelligence/PropertyAngleToConceptFamilyMapper.ts`, which
 * (like `PropertyIntegrityMode`'s own mapper) is free to use only a subset of members for now.
 *
 * "Extensible registry" (the spec's own words) is honored by keeping this a plain string enum plus
 * an exported `readonly` array — adding a 21st member later is a 2-line diff, not a breaking change
 * to any consumer that reads the enum/array rather than hardcoding a count.
 */
export enum ConceptFamily {
  PRICE_DOMINANT = "PRICE_DOMINANT",
  MORTGAGE_CARD = "MORTGAGE_CARD",
  LOCATION_MAP = "LOCATION_MAP",
  LOCATION_COMMUTE = "LOCATION_COMMUTE",
  PREMIUM_EDITORIAL = "PREMIUM_EDITORIAL",
  FAMILY_LIFESTYLE = "FAMILY_LIFESTYLE",
  PROPERTY_FEATURE = "PROPERTY_FEATURE",
  SPEC_GRID = "SPEC_GRID",
  INVESTOR_DATA = "INVESTOR_DATA",
  POV_TOUR = "POV_TOUR",
  UGC_DISCOVERY = "UGC_DISCOVERY",
  PROBLEM_SOLUTION = "PROBLEM_SOLUTION",
  CURIOSITY_REVEAL = "CURIOSITY_REVEAL",
  CAROUSEL_DISCOVERY = "CAROUSEL_DISCOVERY",
  ARCHITECTURAL_DETAIL = "ARCHITECTURAL_DETAIL",
  SOCIAL_NATIVE = "SOCIAL_NATIVE",
  PROPERTY_COMPARISON = "PROPERTY_COMPARISON",
  SCARCITY_DIRECT = "SCARCITY_DIRECT",
  FLOORPLAN_STORY = "FLOORPLAN_STORY",
  NEIGHBORHOOD_STORY = "NEIGHBORHOOD_STORY",
}

/** All 20 members, in the spec's declared order. */
export const ALL_CONCEPT_FAMILIES: readonly ConceptFamily[] = [
  ConceptFamily.PRICE_DOMINANT,
  ConceptFamily.MORTGAGE_CARD,
  ConceptFamily.LOCATION_MAP,
  ConceptFamily.LOCATION_COMMUTE,
  ConceptFamily.PREMIUM_EDITORIAL,
  ConceptFamily.FAMILY_LIFESTYLE,
  ConceptFamily.PROPERTY_FEATURE,
  ConceptFamily.SPEC_GRID,
  ConceptFamily.INVESTOR_DATA,
  ConceptFamily.POV_TOUR,
  ConceptFamily.UGC_DISCOVERY,
  ConceptFamily.PROBLEM_SOLUTION,
  ConceptFamily.CURIOSITY_REVEAL,
  ConceptFamily.CAROUSEL_DISCOVERY,
  ConceptFamily.ARCHITECTURAL_DETAIL,
  ConceptFamily.SOCIAL_NATIVE,
  ConceptFamily.PROPERTY_COMPARISON,
  ConceptFamily.SCARCITY_DIRECT,
  ConceptFamily.FLOORPLAN_STORY,
  ConceptFamily.NEIGHBORHOOD_STORY,
];
