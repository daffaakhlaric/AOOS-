/** A lead's qualification temperature — derived from `LeadScore` against configured thresholds. */
export enum LeadTemperature {
  COLD = "COLD",
  WARM = "WARM",
  HOT = "HOT",
}

/**
 * Classifies a numeric score into `LeadTemperature`, given the configured `warmThreshold`/
 * `hotThreshold` (spec default: warm=31, hot=65). Pinned boundary (spec's "Business correctness"):
 * `score=64` → WARM, `score=65` → HOT.
 */
export function classifyTemperature(
  score: number,
  warmThreshold: number,
  hotThreshold: number,
): LeadTemperature {
  if (score >= hotThreshold) {
    return LeadTemperature.HOT;
  }
  if (score >= warmThreshold) {
    return LeadTemperature.WARM;
  }
  return LeadTemperature.COLD;
}
