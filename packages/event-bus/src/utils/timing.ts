/** Monotonic-enough millisecond timestamp for latency measurement (not wall-clock sensitive). */
export function now(): number {
  return Date.now();
}
