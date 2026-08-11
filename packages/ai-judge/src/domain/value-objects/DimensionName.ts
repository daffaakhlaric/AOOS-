/** The 6 scoring dimensions (spec "6 Scoring Dimensions"), in weighted-formula order. */
export enum DimensionName {
  NATURAL_LANGUAGE = "NATURAL_LANGUAGE",
  QUALIFICATION = "QUALIFICATION",
  OBJECTION_HANDLING = "OBJECTION_HANDLING",
  CLOSING_ATTEMPT = "CLOSING_ATTEMPT",
  HANDOFF_QUALITY = "HANDOFF_QUALITY",
  RESPONSE_LENGTH = "RESPONSE_LENGTH",
}

/** All 6 dimension names, in the spec's canonical listing/weighting order. */
export const ALL_DIMENSION_NAMES: ReadonlyArray<DimensionName> = [
  DimensionName.NATURAL_LANGUAGE,
  DimensionName.QUALIFICATION,
  DimensionName.OBJECTION_HANDLING,
  DimensionName.CLOSING_ATTEMPT,
  DimensionName.HANDOFF_QUALITY,
  DimensionName.RESPONSE_LENGTH,
];
