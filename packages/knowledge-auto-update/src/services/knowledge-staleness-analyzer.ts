import type { FreshnessRules } from "../value-objects/knowledge-update-policy.js";

export interface StalenessResult {
  readonly stale: boolean;
  readonly ageMs: number;
  readonly maxAgeMs: number;
}

/** Real threshold logic: given a last-updated timestamp, current time, and freshness policy. */
export class KnowledgeStalenessAnalyzer {
  analyze(lastUpdatedAt: number, now: number, freshness: FreshnessRules): StalenessResult {
    const ageMs = Math.max(0, now - lastUpdatedAt);
    return { stale: ageMs > freshness.maxAgeMs, ageMs, maxAgeMs: freshness.maxAgeMs };
  }
}
