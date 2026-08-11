/** The 6 lead-qualification criteria Jessy scores against (spec "Lead Scoring Engine"). */
export enum QualificationStatus {
  BUDGET = "BUDGET",
  UNIT = "UNIT",
  AREA = "AREA",
  PAYMENT = "PAYMENT",
  TIMELINE = "TIMELINE",
  NAME = "NAME",
}

/** All 6 members, in the spec's declared order — used by `QualificationDetector`/`LeadProfileBuilder` iteration. */
export const ALL_QUALIFICATION_STATUSES: ReadonlyArray<QualificationStatus> = [
  QualificationStatus.BUDGET,
  QualificationStatus.UNIT,
  QualificationStatus.AREA,
  QualificationStatus.PAYMENT,
  QualificationStatus.TIMELINE,
  QualificationStatus.NAME,
];
