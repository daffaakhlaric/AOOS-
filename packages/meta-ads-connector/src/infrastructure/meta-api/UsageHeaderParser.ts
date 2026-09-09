/**
 * Parses Meta's real `X-Business-Use-Case-Usage` response header (present on Marketing API
 * responses — verified against Meta's Marketing API "Rate Limiting" reference,
 * developers.facebook.com/docs/marketing-api/business-use-case-rate-limiting), Meta's own
 * documented, proactive way to signal "you are approaching your real rate limit" BEFORE the hard
 * 503 "User request limit reached" wall this whole fix responds to.
 *
 * Real, documented JSON shape (keyed by business-id — AAOS has no per-business-id use, it only
 * needs the worst-case percentage across every entry):
 * ```json
 * {"<business-id>": [
 *   {"type":"ads_management","call_count":28,"total_cputime":25,"total_time":25,
 *    "estimated_time_to_regain_access":0}
 * ]}
 * ```
 * `call_count`/`total_cputime`/`total_time` are integer PERCENTAGES (0-100) of the real usage
 * quota consumed; `estimated_time_to_regain_access` is real, documented MINUTES until Meta's own
 * quota resets, present (and non-zero) once usage has actually hit 100%.
 *
 * Deliberately tolerant, never throws: an absent header, malformed JSON, or a shape that doesn't
 * match the documented one all return `undefined` — this is a proactive OPTIMIZATION (skip ahead
 * of the hard limit), never a required signal `MetaApiClient` depends on for correctness. The real
 * 503-classification fix (`toMetaApiError`'s `META_RATE_LIMIT_ERROR_CODE` check) is what makes
 * rate-limit handling correct even when this header is absent/unparseable.
 */

export interface BusinessUseCaseUsage {
  /** Highest of `call_count`/`total_cputime`/`total_time` across every reported entry — the real, honest "how close to the wall are we" signal. */
  readonly maxPercent: number;
  /** Real, documented minutes until Meta's own quota resets; `0` when usage hasn't hit 100% (Meta only reports a nonzero value once access is actually cut). */
  readonly estimatedTimeToRegainAccessMinutes: number;
}

interface RawUsageEntry {
  readonly call_count?: unknown;
  readonly total_cputime?: unknown;
  readonly total_time?: unknown;
  readonly estimated_time_to_regain_access?: unknown;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseBusinessUseCaseUsage(
  headerValue: string | null,
): BusinessUseCaseUsage | undefined {
  if (headerValue === null || headerValue.trim().length === 0) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(headerValue);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }

  let maxPercent = 0;
  let estimatedTimeToRegainAccessMinutes = 0;
  for (const entries of Object.values(parsed as Record<string, unknown>)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries as ReadonlyArray<unknown>) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }
      const raw = entry as RawUsageEntry;
      for (const field of [raw.call_count, raw.total_cputime, raw.total_time]) {
        if (isFiniteNumber(field) && field > maxPercent) {
          maxPercent = field;
        }
      }
      if (
        isFiniteNumber(raw.estimated_time_to_regain_access) &&
        raw.estimated_time_to_regain_access > estimatedTimeToRegainAccessMinutes
      ) {
        estimatedTimeToRegainAccessMinutes = raw.estimated_time_to_regain_access;
      }
    }
  }

  // Nothing usable found (e.g. `{}`, or a shape with no numeric usage fields at all) — treat the
  // same as "header absent" rather than reporting a false 0%-usage signal that could mask a real
  // absent-header case from a genuinely-idle one in a caller that branches on `undefined`.
  if (maxPercent === 0 && estimatedTimeToRegainAccessMinutes === 0) {
    return undefined;
  }

  return { maxPercent, estimatedTimeToRegainAccessMinutes };
}
