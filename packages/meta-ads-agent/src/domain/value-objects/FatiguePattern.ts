import type { Funnel } from "@aos/meta-ads-connector";

/** One funnel's observed average days-active before `frequency > 3.5` (creative fatigue) — AAOS-W1D-S1S2 (S1). */
export interface FatiguePattern {
  readonly funnel: Funnel;
  readonly avgDaysToFatigue: number;
}

/** Builds the `Map<Funnel, number>` shape `AgentMemory.fatiguePatterns` / `KNOWN_FATIGUE_PATTERNS` use, from a list of `FatiguePattern` entries. */
export function toFatiguePatternMap(patterns: ReadonlyArray<FatiguePattern>): Map<Funnel, number> {
  return new Map(patterns.map((p) => [p.funnel, p.avgDaysToFatigue] as const));
}
