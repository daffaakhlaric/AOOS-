import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/**
 * The raw `successFlag` field from a Kie AI `GET /api/v1/jobs/{taskId}` poll response (Part 4 of
 * the spec): `0` = still generating, `1` = success, `2` = failed, `3` = generation failed.
 *
 * Per design resolution #4, `FAILED` (2) and `GEN_FAILED` (3) are kept as distinct members here
 * for API fidelity — matching the spec's own pinned test names — even though both collapse to the
 * identical `GenerationFailedError` one layer up, in `TaskPoller`.
 */
export enum SuccessFlag {
  PENDING = 0,
  SUCCESS = 1,
  FAILED = 2,
  GEN_FAILED = 3,
}

const VALID_FLAGS: ReadonlySet<number> = new Set([
  SuccessFlag.PENDING,
  SuccessFlag.SUCCESS,
  SuccessFlag.FAILED,
  SuccessFlag.GEN_FAILED,
]);

/** Smart-constructs a `SuccessFlag` from the raw numeric field on the poll response body. */
export function parseSuccessFlag(raw: number): Result<SuccessFlag, ValidationError> {
  if (typeof raw !== "number" || !VALID_FLAGS.has(raw)) {
    return err(
      new ValidationError(
        `successFlag must be one of 0, 1, 2, 3, received: ${JSON.stringify(raw)}`,
      ),
    );
  }
  return ok(raw as SuccessFlag);
}
