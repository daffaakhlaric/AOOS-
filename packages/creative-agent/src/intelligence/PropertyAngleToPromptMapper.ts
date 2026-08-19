import { PropertyAdAngle } from "../domain/value-objects/PropertyAdAngle.js";

/**
 * Maps each `PropertyAdAngle` to an English Kie AI prompt style fragment — the PROPERTY
 * vertical's sibling to `AngleToPromptMapper` (same exhaustive-`Record` discipline, so a new
 * `PropertyAdAngle` member fails to typecheck here until it's given a style).
 */
const PROPERTY_ANGLE_PROMPT_STYLES: Readonly<Record<PropertyAdAngle, string>> = {
  [PropertyAdAngle.DP_RINGAN]:
    "affordable down payment, accessible homeownership, welcoming and approachable",
  [PropertyAdAngle.READY_HUNI]: "move-in ready, turnkey, immaculate finish, warm and livable",
  [PropertyAdAngle.INVESTASI]: "smart investment, rising property value, aspirational lifestyle",
  [PropertyAdAngle.EXCLUSIVE]: "exclusive, premium, private, refined luxury living",
  [PropertyAdAngle.SYARIAH]: "trustworthy, Islamic finance, halal, transparent, family values",
  [PropertyAdAngle.PROMO_TERBATAS]: "limited-time offer, urgency, exclusive promotion, act now",
  [PropertyAdAngle.TESTIMONIAL]: "authentic, happy homeowner, real experience, satisfied family",
  [PropertyAdAngle.VIRTUAL_TOUR]:
    "immersive walkthrough, cinematic reveal, spacious interior showcase",
};

/** Deterministic `PropertyAdAngle` → English Kie AI prompt style lookup — no LLM calls, no randomness. */
export class PropertyAngleToPromptMapper {
  static styleFor(angle: PropertyAdAngle): string {
    return PROPERTY_ANGLE_PROMPT_STYLES[angle];
  }
}
