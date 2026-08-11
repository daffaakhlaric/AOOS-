/**
 * Hour-of-day (0-23) → relative lead-volume index — AAOS-W1D-S1S2 (S1).
 *
 * Design judgment call (spec left the shape unspecified — "hour → lead index"): modeled as a
 * `ReadonlyMap<number, number>` rather than a 24-entry array, for consistency with this
 * supplement's other hour/funnel-keyed shapes (`AgentMemory.fatiguePatterns: Map<Funnel, number>`,
 * `KNOWN_FATIGUE_PATTERNS: Map<Funnel, number>`) — a sparse map also lets "no data for this hour
 * yet" be represented as "key absent" rather than needing a sentinel array value.
 */
export type SeasonalPattern = ReadonlyMap<number, number>;

/** Builds a `SeasonalPattern`, validating every hour key is within `0..23`. */
export function createSeasonalPattern(
  entries: ReadonlyArray<readonly [number, number]>,
): SeasonalPattern {
  const map = new Map<number, number>();
  for (const [hour, index] of entries) {
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isFinite(index)) {
      map.set(hour, index);
    }
  }
  return map;
}
