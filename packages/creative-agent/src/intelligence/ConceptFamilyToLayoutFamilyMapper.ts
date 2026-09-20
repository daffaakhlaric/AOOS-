import { ConceptFamily } from "../domain/value-objects/ConceptFamily.js";
import { LayoutFamily } from "../domain/value-objects/LayoutFamily.js";

/**
 * PROMPT 58 — DYNAMIC LAYOUT ENGINE, smallest honest on-ramp mirroring PROMPT 44's own
 * `PropertyAngleToConceptFamilyMapper` structure exactly: a deterministic, exhaustive `Record`
 * mapping every real `ConceptFamily` (20 members — see `ConceptFamily.ts`'s own doc for the
 * verbatim spec text) to a real `LayoutFamily` (11 members — see `LayoutFamily.ts`'s own doc).
 *
 * Unlike `PropertyAngleToConceptFamilyMapper.familiesFor`, which returns a SMALL SET (1-2 plausible
 * concept families per angle, because more than one visual treatment can honestly express the same
 * marketing appeal), this mapper returns EXACTLY ONE `LayoutFamily` per `ConceptFamily` — a single
 * generated image can only be arranged in one physical layout at a time, so "the most natural fit"
 * must be resolved to a single deterministic answer, never a set the caller would have to
 * arbitrarily pick from. Where a concept family's real meaning already overlaps a layout family's
 * name (`PRICE_DOMINANT`, `SPEC_GRID`, `MORTGAGE_CARD` — see `LayoutFamily.ts`'s doc), the mapping
 * is the identical, unambiguous name; every other concept family is mapped to whichever layout
 * family most honestly matches its real, documented meaning (see each entry's inline comment).
 *
 * This mapping is a pure taxonomy resolution — it does NOT imply the resolved `LayoutFamily` has
 * real, bespoke pixel-positioning logic yet. `creative-image-overlay.ts`'s own
 * `IMPLEMENTED_LAYOUT_FAMILIES` is the separate, narrower answer to "which of these 11 actually
 * render distinctly today" (currently `BOTTOM_INFO_BAR` and `HERO_FULL_BLEED`); any other resolved
 * family honestly falls back to the default `BOTTOM_INFO_BAR` compositing there, never a silent
 * broken layout.
 */
const CONCEPT_TO_LAYOUT_FAMILY: Readonly<Record<ConceptFamily, LayoutFamily>> = {
  // Exact real vocabulary overlap (see `LayoutFamily.ts`'s doc) — the concept family's own name IS
  // the layout family.
  [ConceptFamily.PRICE_DOMINANT]: LayoutFamily.PRICE_DOMINANT,
  [ConceptFamily.MORTGAGE_CARD]: LayoutFamily.MORTGAGE_CARD,
  [ConceptFamily.SPEC_GRID]: LayoutFamily.SPEC_GRID,

  // Location-appeal concept families are both real map-shaped treatments.
  [ConceptFamily.LOCATION_MAP]: LayoutFamily.MAP_HYBRID,
  [ConceptFamily.LOCATION_COMMUTE]: LayoutFamily.MAP_HYBRID,
  [ConceptFamily.NEIGHBORHOOD_STORY]: LayoutFamily.MAP_HYBRID,

  // Premium/refined-detail treatments read as the spec's own "editorial luxury" layout.
  [ConceptFamily.PREMIUM_EDITORIAL]: LayoutFamily.EDITORIAL_LUXURY,
  [ConceptFamily.ARCHITECTURAL_DETAIL]: LayoutFamily.EDITORIAL_LUXURY,

  // Immersive/lifestyle/native-feed treatments want the image itself dominant, minimal chrome —
  // the spec's full-bleed hero layout.
  [ConceptFamily.FAMILY_LIFESTYLE]: LayoutFamily.HERO_FULL_BLEED,
  [ConceptFamily.POV_TOUR]: LayoutFamily.HERO_FULL_BLEED,
  [ConceptFamily.SOCIAL_NATIVE]: LayoutFamily.HERO_FULL_BLEED,

  // A direct feature/urgency callout is the spec's own "bottom info bar" banner treatment — the
  // SAME real layout `creative-image-overlay.ts` already builds today (Phase 29/30).
  [ConceptFamily.PROPERTY_FEATURE]: LayoutFamily.BOTTOM_INFO_BAR,
  [ConceptFamily.SCARCITY_DIRECT]: LayoutFamily.BOTTOM_INFO_BAR,

  // Data-forward appeals suit a floating data card over the image.
  [ConceptFamily.INVESTOR_DATA]: LayoutFamily.FLOATING_CARD,

  // Discovery-shaped treatments are literally the spec's own "property discovery" layout family.
  [ConceptFamily.UGC_DISCOVERY]: LayoutFamily.PROPERTY_DISCOVERY,
  [ConceptFamily.CAROUSEL_DISCOVERY]: LayoutFamily.PROPERTY_DISCOVERY,

  // A/B or before/after framing is a real split-screen treatment.
  [ConceptFamily.PROBLEM_SOLUTION]: LayoutFamily.SPLIT_SCREEN,
  [ConceptFamily.PROPERTY_COMPARISON]: LayoutFamily.SPLIT_SCREEN,

  // An unconventional, attention-breaking reveal fits the spec's asymmetric editorial treatment.
  [ConceptFamily.CURIOSITY_REVEAL]: LayoutFamily.ASYMMETRIC_EDITORIAL,

  // A floorplan's own real shape (a structured diagram) is the same "grid of real facts" idea the
  // spec's SPEC_GRID layout already names.
  [ConceptFamily.FLOORPLAN_STORY]: LayoutFamily.SPEC_GRID,
};

/**
 * Deterministic `ConceptFamily` -> `LayoutFamily` lookup — no LLM calls, no randomness, exactly one
 * answer per concept family (never a set). Matches `PropertyAngleToConceptFamilyMapper.familiesFor`'s
 * plain-lookup style.
 */
export class ConceptFamilyToLayoutFamilyMapper {
  static layoutFor(conceptFamily: ConceptFamily): LayoutFamily {
    return CONCEPT_TO_LAYOUT_FAMILY[conceptFamily];
  }
}
