import type { PriorityRules } from "../value-objects/knowledge-update-policy.js";

export interface PriorityCalculationInput {
  /** The job's own base priority (caller/factory-assigned). */
  readonly basePriority: number;
  /** Staleness ratio, `ageMs / maxAgeMs` (unclamped — callers may pass > 1 for very stale jobs). */
  readonly stalenessRatio: number;
  /** Number of other pending jobs that depend on this one (criticality signal). */
  readonly dependentCount: number;
}

/**
 * Real, deterministic priority scoring: a weighted sum of base priority, staleness ratio, and
 * dependency criticality, combined via the policy's `PriorityRules` weights. Higher score = more
 * urgent = dequeued first by the scheduler's priority queue.
 */
export class KnowledgePriorityCalculator {
  calculate(input: PriorityCalculationInput, rules: PriorityRules): number {
    return (
      rules.baseWeight * input.basePriority +
      rules.stalenessWeight * input.stalenessRatio +
      rules.dependencyWeight * input.dependentCount
    );
  }
}
