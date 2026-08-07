/** A single sample used by the time-bucketing / trend helpers below. */
export interface TimestampedValue {
  readonly timestamp: number;
  readonly value: number;
}

/** One time bucket: the average of every sample whose timestamp fell inside `[start, end)`. */
export interface TimeBucket {
  readonly start: number;
  readonly end: number;
  readonly average: number;
  readonly count: number;
}

/**
 * Groups `samples` into fixed-width `bucketSizeMs` buckets anchored at the earliest sample's
 * timestamp, and computes each bucket's average value. Buckets with no samples are omitted.
 * Samples are not required to be pre-sorted.
 */
export function bucketByInterval(
  samples: readonly TimestampedValue[],
  bucketSizeMs: number,
): TimeBucket[] {
  if (samples.length === 0) return [];
  if (bucketSizeMs <= 0) {
    throw new RangeError(`bucketSizeMs must be positive, received ${bucketSizeMs}`);
  }

  const origin = Math.min(...samples.map((sample) => sample.timestamp));
  const grouped = new Map<number, number[]>();
  for (const sample of samples) {
    const bucketIndex = Math.floor((sample.timestamp - origin) / bucketSizeMs);
    const values = grouped.get(bucketIndex) ?? [];
    values.push(sample.value);
    grouped.set(bucketIndex, values);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketIndex, values]) => {
      const start = origin + bucketIndex * bucketSizeMs;
      return {
        start,
        end: start + bucketSizeMs,
        average: values.reduce((total, value) => total + value, 0) / values.length,
        count: values.length,
      };
    });
}

/**
 * Computes the slope of a simple linear regression line (ordinary least squares) fitted against
 * `buckets`' averages, using each bucket's index (0, 1, 2, …) as the independent variable. A
 * positive slope means the metric is trending upward bucket-over-bucket, negative means downward,
 * 0 means flat. Returns 0 when there are fewer than 2 buckets (a trend needs at least two points).
 */
export function calculateTrendSlope(buckets: readonly TimeBucket[]): number {
  const n = buckets.length;
  if (n < 2) return 0;

  const xs = buckets.map((_, index) => index);
  const ys = buckets.map((bucket) => bucket.average);
  const meanX = xs.reduce((total, x) => total + x, 0) / n;
  const meanY = ys.reduce((total, y) => total + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    numerator += dx * (ys[i]! - meanY);
    denominator += dx * dx;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Period-over-period delta: `(latest.average - previous.average) / previous.average`, expressed
 * as a ratio (e.g. 0.1 = +10%). Returns 0 when there are fewer than 2 buckets or the previous
 * bucket's average is 0 (division by zero is avoided rather than producing `Infinity`/`NaN`).
 */
export function calculatePeriodOverPeriodDelta(buckets: readonly TimeBucket[]): number {
  if (buckets.length < 2) return 0;
  const previous = buckets[buckets.length - 2]!;
  const latest = buckets[buckets.length - 1]!;
  if (previous.average === 0) return 0;
  return (latest.average - previous.average) / previous.average;
}
