/**
 * The optimization verdict computed for an Ad by the VerdictEngine
 * (see `domain/services/VerdictEngine.ts`).
 */
export enum Verdict {
  SCALE = "SCALE",
  KEEP = "KEEP",
  REVIEW = "REVIEW",
  REFRESH = "REFRESH",
  FIX = "FIX",
  PAUSE = "PAUSE",
}
