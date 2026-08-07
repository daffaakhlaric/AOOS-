const counters = new Map<string, number>();

/** Deterministic, monotonically-increasing id generator: `${prefix}-${n}`. No randomness. */
export function generateId(prefix: string): string {
  const next = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, next);
  return `${prefix}-${next}`;
}

/** Resets all counters. Intended for test isolation only. */
export function resetIdCounters(): void {
  counters.clear();
}
