/**
 * This package's own lifecycle status for a `GenerationTask`, distinct from the raw Kie AI
 * `SuccessFlag` it is derived from: `PENDING` (task created, not polled yet — no `SuccessFlag`
 * observed), `GENERATING` (`SuccessFlag.PENDING`/0 observed at least once), `SUCCESS`
 * (`SuccessFlag.SUCCESS`/1), `FAILED` (`SuccessFlag.FAILED`/2 or `SuccessFlag.GEN_FAILED`/3 —
 * collapsed here per design resolution #4).
 */
export enum TaskStatus {
  PENDING = "PENDING",
  GENERATING = "GENERATING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}
