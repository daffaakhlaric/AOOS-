import { AdAngle } from "@aos/meta-ads-agent";

/**
 * Real angle pairs/triples for auto-generated A/B test variants (AAOS-ABTESTING-LOOKALIKE,
 * coordinator note section 2). The spec's own `ANGLE_PAIRS` used fictional members
 * (`STOK_TERBATAS`, `KPR_MUDAH`) that do not exist in `@aos/meta-ads-agent`'s real `AdAngle` enum
 * (`DP_RINGAN, KREDIT_SYARIAH, GUDANGNYA, QNA, DISCOVERY, TESTIMONIAL, WEBSITE_REDIRECT`) — this
 * file uses only real members, substituting `GUDANGNYA` (the real stock-themed angle) for the
 * spec's `STOK_TERBATAS`.
 *
 * AUTOMOTIVE only: `apps/aaos-api`'s composed creative pipeline (`CreativePackagesService`,
 * `CreatePackageBodySchema`) only validates `angle` against `@aos/meta-ads-agent`'s `AdAngle` —
 * there is no PROPERTY-vertical wiring into that pipeline in this app today (`PropertyAdAngle` is
 * used only by `packages/creative-agent`'s own PROPERTY prompt builder, never by `aaos-api`'s
 * Kai composition). A/B Testing therefore only supports AUTOMOTIVE-vertical campaigns for now.
 */
export type AnglePair = readonly [AdAngle, AdAngle];
export type AngleTriple = readonly [AdAngle, AdAngle, AdAngle];
export type AngleSet = AnglePair | AngleTriple;

const ANGLE_PAIRS: readonly AnglePair[] = [
  [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA],
  [AdAngle.DP_RINGAN, AdAngle.TESTIMONIAL],
  [AdAngle.KREDIT_SYARIAH, AdAngle.DISCOVERY],
  [AdAngle.QNA, AdAngle.DP_RINGAN],
];

const ANGLE_TRIPLES: readonly AngleTriple[] = [
  [AdAngle.DP_RINGAN, AdAngle.DISCOVERY, AdAngle.QNA],
  [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA, AdAngle.TESTIMONIAL],
];

/** Pure — a stable, order-independent key for a set of angles, used to detect "already tested for this campaign" (spec's `selectUnusedAnglePair`). Accepts plain `string[]` too so a persisted variant row's `angle` column (stored as free TEXT) can be compared against a real `AngleSet` without a cast. */
export function angleSetKey(angles: readonly string[]): string {
  return [...angles].sort().join("|");
}

/**
 * Pure — picks the first candidate pair/triple (from the fixed pools above) whose key is not in
 * `usedKeys` (angle sets this campaign has already tested). Falls back to the pool's first entry
 * once every candidate has been used (cycling), rather than throwing — an exhausted pool is a
 * real, expected state for a campaign under long-running iterative testing, not an error.
 */
export function selectUnusedAngleSet(usedKeys: ReadonlySet<string>, count: 2 | 3): AngleSet {
  const pool: readonly AngleSet[] = count === 2 ? ANGLE_PAIRS : ANGLE_TRIPLES;
  const unused = pool.find((candidate) => !usedKeys.has(angleSetKey(candidate)));
  const first = pool[0];
  /* v8 ignore next -- unreachable: both pools above are non-empty literals. */
  if (first === undefined) {
    throw new Error("Angle set pool is empty");
  }
  return unused ?? first;
}

/** `String.fromCharCode(65 + i)` per the spec — `'A' | 'B' | 'C'` for index 0/1/2. */
export function variantLabelForIndex(index: number): string {
  return String.fromCharCode(65 + index);
}
