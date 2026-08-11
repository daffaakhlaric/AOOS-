/** The Objective's own lifecycle state, distinct from `OnTrackStatus` (which describes pacing, not lifecycle). */
export enum ObjectiveStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}
