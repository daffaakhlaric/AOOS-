/** High-resolution monotonic timestamp in milliseconds, suitable for duration measurement. */
export function now(): number {
  return performance.now();
}

/** Measures the duration (ms) of an async function, returning both its result and the elapsed time. */
export async function measureDurationMs<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = now();
  const result = await fn();
  return { result, durationMs: now() - start };
}
