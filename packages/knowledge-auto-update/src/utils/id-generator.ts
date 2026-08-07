/**
 * Deterministic, monotonically-increasing id generator (no `crypto.randomUUID`, no OS entropy) —
 * keeps every entity id reproducible across test runs. Each prefix keeps its own counter.
 */
const counters = new Map<string, number>();

export function generateId(prefix: string): string {
  const next = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, next);
  return `${prefix}_${next}`;
}

/** Resets all counters. Test-only convenience so ids are reproducible across spec files. */
export function resetIdCounters(): void {
  counters.clear();
}
