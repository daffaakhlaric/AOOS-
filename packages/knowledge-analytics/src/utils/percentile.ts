import { InvalidSampleException } from "../errors/invalid-sample-exception.js";

/**
 * Computes the `p`-th percentile (0-100) of `values` using linear interpolation between closest
 * ranks (the same method as NumPy's default `percentile` / Excel's `PERCENTILE.INC`):
 *
 *   index  = p / 100 * (n - 1)
 *   result = sorted[floor(index)] + (index - floor(index)) * (sorted[ceil(index)] - sorted[floor(index)])
 *
 * `values` need not be pre-sorted; a sorted copy is taken internally so the caller's array is
 * never mutated.
 */
export function calculatePercentile(values: readonly number[], p: number): number {
  if (p < 0 || p > 100) {
    throw new InvalidSampleException(`Percentile must be between 0 and 100, received ${p}`);
  }
  if (values.length === 0) {
    throw new InvalidSampleException("Cannot compute a percentile of an empty sample set");
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;

  const lowerValue = sorted[lower]!;
  const upperValue = sorted[upper]!;
  return lowerValue + (index - lower) * (upperValue - lowerValue);
}
