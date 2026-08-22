/**
 * Persisted state for one Meta Custom/Lookalike Audience (AAOS-ABTESTING-LOOKALIKE Part 2).
 * Mirrors `modules/abtesting/domain/ab-test.ts`'s convention: a plain `Stored*` interface in
 * camelCase, mapped to/from snake_case rows inside the repository.
 */
export type MetaAudienceType = "HOT_LEADS" | "LOOKALIKE_1PCT" | "LOOKALIKE_2PCT" | "LOOKALIKE_3PCT";

export type MetaAudienceStatus = "ACTIVE" | "FAILED";

export interface StoredMetaAudience {
  readonly id: string;
  readonly tenantId: string;
  readonly metaAudienceId: string;
  readonly audienceType: MetaAudienceType;
  readonly name: string;
  /** Real, AAOS-tracked count — for `HOT_LEADS`, the number of phone numbers successfully uploaded so far (not Meta's own post-matching audience size, which this connector has no verified read endpoint for). */
  readonly size?: number;
  /** For a `LOOKALIKE_*` row: the `HOT_LEADS` row's `meta_audience_id` it was generated from. */
  readonly originAudienceId?: string;
  /** For a `LOOKALIKE_*` row: 1, 2, or 3. */
  readonly percentage?: number;
  readonly status: MetaAudienceStatus;
  readonly lastUpdatedAt?: string;
  readonly createdAt: string;
}

/** `LOOKALIKE_{n}PCT` for a given percentage — the single place this string is built. */
export function lookalikeAudienceType(percentage: 1 | 2 | 3): MetaAudienceType {
  return `LOOKALIKE_${String(percentage)}PCT` as MetaAudienceType;
}
