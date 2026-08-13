import { AdAngle } from "@aos/meta-ads-agent";

/**
 * Maps each `AdAngle` to an English Kie AI prompt style fragment (spec "Automotive Prompt
 * Builder" → "AngleToPromptMapper — maps AdAngle → prompt style").
 *
 * COORDINATOR NOTE #5 applied: the spec's own `ANGLE_PROMPT_STYLES` table only lists 6 angles.
 * The real `AdAngle` (`packages/meta-ads-agent/src/domain/value-objects/AdAngle.ts`) has a
 * SEVENTH member, `WEBSITE_REDIRECT`, added by the AAOS-W1D-S1S2 supplement. This
 * `Record<AdAngle, string>` MUST cover all 7 or it fails to typecheck as exhaustive — the
 * `WEBSITE_REDIRECT` entry below ("direct response, click-through intent, clear call to action,
 * straightforward messaging") is exactly the style the coordinator note suggested.
 */
const ANGLE_PROMPT_STYLES: Readonly<Record<AdAngle, string>> = {
  [AdAngle.DP_RINGAN]: "affordable financing, accessible, family-friendly, welcoming dealership",
  [AdAngle.KREDIT_SYARIAH]: "trustworthy, Islamic finance, halal, transparent, family values",
  [AdAngle.GUDANGNYA]: "large selection, abundance, professional showroom, top quality",
  [AdAngle.QNA]: "educational, trustworthy, honest, expert advice, transparent",
  [AdAngle.DISCOVERY]: "discovery, comparison, value for money, smart choice",
  [AdAngle.TESTIMONIAL]: "authentic, happy customer, real experience, satisfied family",
  [AdAngle.WEBSITE_REDIRECT]:
    "direct response, click-through intent, clear call to action, straightforward messaging",
};

/** Deterministic `AdAngle` → English Kie AI prompt style lookup — no LLM calls, no randomness. */
export class AngleToPromptMapper {
  static styleFor(angle: AdAngle): string {
    return ANGLE_PROMPT_STYLES[angle];
  }
}
