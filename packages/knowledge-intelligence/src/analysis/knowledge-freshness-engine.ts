import type { IClock } from "../contracts/i-clock.js";
import type { KnowledgeItemSnapshot } from "../types/knowledge-item.js";
import { clamp, evaluateThreshold } from "../utils/scoring-math.js";
import type { KnowledgeIntelligenceConfiguration } from "../value-objects/knowledge-intelligence-configuration.js";
import { KnowledgeScore } from "../value-objects/knowledge-score.js";

const FRESHNESS_BANDS = [
  { label: "fresh", min: 70 },
  { label: "aging", min: 40 },
  { label: "stale", min: 0 },
];

/**
 * Real time-dependent Freshness score using a linear decay curve:
 * `score = 100 * (1 - age / maxAge)`, clamped to `[0, 100]`. `age` is derived from the injected
 * `IClock` — never `Date.now()` — so the computation is fully deterministic and reproducible.
 */
export class KnowledgeFreshnessEngine {
  constructor(
    private readonly clock: IClock,
    private readonly config: KnowledgeIntelligenceConfiguration,
  ) {}

  score(item: KnowledgeItemSnapshot): KnowledgeScore {
    const ageMs = Math.max(0, this.clock.now() - item.lastUpdatedAt);
    const value = clamp(100 * (1 - ageMs / this.config.freshnessMaxAgeMs), 0, 100);
    return new KnowledgeScore({
      name: "freshness",
      value,
      band: evaluateThreshold(value, FRESHNESS_BANDS),
    });
  }

  isStale(item: KnowledgeItemSnapshot): boolean {
    const ageMs = Math.max(0, this.clock.now() - item.lastUpdatedAt);
    return ageMs > this.config.freshnessMaxAgeMs;
  }

  ageMs(item: KnowledgeItemSnapshot): number {
    return Math.max(0, this.clock.now() - item.lastUpdatedAt);
  }
}
