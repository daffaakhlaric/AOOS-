/**
 * Shared, hand-verifiable fixtures used across the test suite. Keeping these in one place means
 * every spec file that asserts exact percentile/average/rate values is checking against the same
 * independently-verified numbers.
 */

/** 1..100 inclusive — chosen because its percentiles/average are trivial to hand-verify. */
export const ONE_TO_HUNDRED: readonly number[] = Array.from({ length: 100 }, (_, i) => i + 1);

/**
 * Hand-verified statistics for {@link ONE_TO_HUNDRED} under linear-interpolation percentiles
 * (index = p/100 * (n-1)):
 *   average = (1 + 100) / 2 = 50.5
 *   p50: index = 0.5 * 99 = 49.5  -> values[49]=50, values[50]=51 -> 50 + 0.5*(51-50) = 50.5
 *   p95: index = 0.95 * 99 = 94.05 -> values[94]=95, values[95]=96 -> 95 + 0.05*(96-95) = 95.05
 *   p99: index = 0.99 * 99 = 98.01 -> values[98]=99, values[99]=100 -> 99 + 0.01*(100-99) = 99.01
 */
export const ONE_TO_HUNDRED_STATS = {
  sum: 5050,
  average: 50.5,
  min: 1,
  max: 100,
  p50: 50.5,
  p95: 95.05,
  p99: 99.01,
} as const;

/** A small, exactly hand-computable latency sample set (ms). */
export const SMALL_LATENCY_SAMPLE: readonly number[] = [10, 20, 30, 40, 50];
export const SMALL_LATENCY_STATS = {
  sum: 150,
  average: 30,
  min: 10,
  max: 50,
  // index = 0.95 * 4 = 3.8 -> values[3]=40, values[4]=50 -> 40 + 0.8*(50-40) = 48
  p95: 48,
  // index = 0.99 * 4 = 3.96 -> values[3]=40, values[4]=50 -> 40 + 0.96*(50-40) = 49.6
  p99: 49.6,
} as const;

/** 80 hits + 20 misses, in a deterministic interleaved order (hit, hit, hit, hit, miss ×1, repeat). */
export const HIT_MISS_SEQUENCE: readonly boolean[] = Array.from(
  { length: 100 },
  (_, i) => i % 5 !== 4,
);
export const HIT_MISS_STATS = {
  total: 100,
  hits: 80,
  misses: 20,
  hitRate: 0.8,
  missRate: 0.2,
} as const;

/** A fixed base timestamp (2024-01-01T00:00:00.000Z) so time-based fixtures never depend on `Date.now()`. */
export const FIXED_TIMESTAMP = 1_704_067_200_000;
