/** High-resolution monotonic timestamp in milliseconds. See id.ts's note on intentional duplication. */
export function now(): number {
  return performance.now();
}
