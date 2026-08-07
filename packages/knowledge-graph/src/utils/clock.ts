/** Returns the current epoch-millisecond timestamp. Kept as an indirection point for deterministic testing. */
export function now(): number {
  return Date.now();
}

/** Returns a high-resolution monotonic timestamp (milliseconds, fractional) for duration measurement. */
export function highResolutionNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
