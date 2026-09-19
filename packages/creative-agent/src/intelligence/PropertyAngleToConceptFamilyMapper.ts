import { ConceptFamily } from "../domain/value-objects/ConceptFamily.js";
import { PropertyAdAngle } from "../domain/value-objects/PropertyAdAngle.js";

/**
 * PROMPT 44 — KAI CONCEPT ENGINE, smallest honest on-ramp identified in the Phase 27 deep-Kai-
 * pipeline audit: a deterministic mapper from the real, existing `PropertyAdAngle` (8 members) to
 * the real spec `ConceptFamily` vocabulary (20 members, see `ConceptFamily.ts`'s own doc for the
 * verbatim spec text). Same "deterministic mapper, no LLM, no randomness" discipline
 * `PropertyAngleToPromptMapper`/`AngleToPromptMapper` already establish — and the same exhaustive-
 * `Record` discipline (a new `PropertyAdAngle` member fails to typecheck here until it's given a
 * mapping).
 *
 * Each angle maps to a SMALL SET (1-2) of plausible concept families, never all 20 and never a
 * single "the" family per angle — an angle is a marketing appeal (WHY buy), a concept family is a
 * visual/structural treatment (HOW it's shown), and more than one treatment can honestly express
 * the same appeal. This is a real classification grounded in what each angle actually means, not a
 * fabricated ranking — see each entry's inline comment for the specific justification. This is
 * deliberately NOT the spec's larger autonomous "Concept Engine" (auto-selecting/ranking which
 * families to actually USE per generation batch) — that overlaps PROMPT 45 (Creative Diversity
 * Engine) and PROMPT 51 (Mass Generation), both out of scope here. This file only answers "which
 * concept families are a plausible fit for this angle", nothing more.
 */
const ANGLE_CONCEPT_FAMILIES: Readonly<Record<PropertyAdAngle, readonly ConceptFamily[]>> = {
  // DP_RINGAN ("affordable down payment, accessible homeownership") is fundamentally a price/
  // financing appeal: PRICE_DOMINANT leads with the DP figure itself, MORTGAGE_CARD is the natural
  // structured-installment-breakdown treatment of the same appeal.
  [PropertyAdAngle.DP_RINGAN]: [ConceptFamily.PRICE_DOMINANT, ConceptFamily.MORTGAGE_CARD],

  // READY_HUNI ("move-in ready, turnkey, immaculate finish") is about the finished unit's real,
  // inspectable features — PROPERTY_FEATURE is the direct fit; POV_TOUR (walking through a
  // genuinely move-in-ready space) is the natural video-shaped sibling treatment.
  [PropertyAdAngle.READY_HUNI]: [ConceptFamily.PROPERTY_FEATURE, ConceptFamily.POV_TOUR],

  // INVESTASI ("smart investment, rising property value") is a data-backed financial appeal —
  // INVESTOR_DATA is the direct fit (ROI/appreciation framing); NEIGHBORHOOD_STORY supports the
  // same appeal from the area-growth angle rather than the unit-price angle.
  [PropertyAdAngle.INVESTASI]: [ConceptFamily.INVESTOR_DATA, ConceptFamily.NEIGHBORHOOD_STORY],

  // EXCLUSIVE ("exclusive, premium, private, refined luxury") reads as a magazine-style premium
  // treatment (PREMIUM_EDITORIAL) grounded in the unit's real refined details (ARCHITECTURAL_DETAIL).
  [PropertyAdAngle.EXCLUSIVE]: [
    ConceptFamily.PREMIUM_EDITORIAL,
    ConceptFamily.ARCHITECTURAL_DETAIL,
  ],

  // SYARIAH ("trustworthy, Islamic finance, halal, transparent, family values") is a financing-
  // structure appeal (MORTGAGE_CARD fits the transparent-installment framing) delivered through a
  // family-trust lens (FAMILY_LIFESTYLE).
  [PropertyAdAngle.SYARIAH]: [ConceptFamily.MORTGAGE_CARD, ConceptFamily.FAMILY_LIFESTYLE],

  // PROMO_TERBATAS ("limited-time offer, urgency, exclusive promotion, act now") is definitionally
  // a scarcity/urgency appeal (SCARCITY_DIRECT) anchored to a real discounted price (PRICE_DOMINANT).
  [PropertyAdAngle.PROMO_TERBATAS]: [ConceptFamily.SCARCITY_DIRECT, ConceptFamily.PRICE_DOMINANT],

  // TESTIMONIAL ("authentic, happy homeowner, real experience") is inherently the UGC_DISCOVERY
  // treatment (a real person's account), naturally distributed as SOCIAL_NATIVE-feeling content.
  [PropertyAdAngle.TESTIMONIAL]: [ConceptFamily.UGC_DISCOVERY, ConceptFamily.SOCIAL_NATIVE],

  // VIRTUAL_TOUR ("immersive walkthrough, cinematic reveal, spacious interior showcase") is
  // definitionally POV_TOUR; CAROUSEL_DISCOVERY is the natural multi-image-sequence sibling when
  // the same walkthrough intent is expressed as images rather than video.
  [PropertyAdAngle.VIRTUAL_TOUR]: [ConceptFamily.POV_TOUR, ConceptFamily.CAROUSEL_DISCOVERY],
};

/**
 * Deterministic `PropertyAdAngle` -> `ConceptFamily[]` lookup — no LLM calls, no randomness. Always
 * returns a non-empty, readonly array (never mutated, never a fresh allocation per call, matching
 * `PropertyAngleToPromptMapper.styleFor`'s plain-lookup style).
 */
export class PropertyAngleToConceptFamilyMapper {
  static familiesFor(angle: PropertyAdAngle): readonly ConceptFamily[] {
    return ANGLE_CONCEPT_FAMILIES[angle];
  }
}
