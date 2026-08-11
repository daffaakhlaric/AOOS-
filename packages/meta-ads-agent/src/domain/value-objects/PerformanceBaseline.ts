import type { Branch, Funnel } from "@aos/meta-ads-connector";

import type { AdAngle } from "./AdAngle.js";

/**
 * A historical average performance figure for one branch × funnel (× optional angle) segment —
 * AAOS-W1D-S1S2 (S1).
 *
 * Design judgment call: the spec's `KNOWN_PERFORMANCE_BASELINES` seed data (branch × funnel
 * granularity, `avgRphLead` only, no `angle`/`avgRphChat`) and the spec's `VerdictDecisionEngine`
 * pseudocode (keyed `${branch}-${funnel}-${angle}`, reading `.avgRphChat`) describe two slightly
 * different shapes of the "same" concept. Reconciled here as one interface with `angle` and
 * `avgRphChat` optional: `KNOWN_PERFORMANCE_BASELINES` populates the coarse branch×funnel form
 * (angle/avgRphChat absent), while `HistoricalLearningService.learn()`'s dynamically-computed
 * baselines populate the full branch×funnel×angle form the blended-avg formula and
 * `AngleRecommender` need. Modeled as a plain readonly interface (not a validated Value Object
 * class) for consistency with `BusinessKnowledgeBase`'s existing `ClientProfile`/`PersonaProfile`
 * structured-data convention, since this is descriptive seed/derived data, not a domain invariant.
 */
export interface PerformanceBaseline {
  readonly branch: Branch;
  readonly funnel: Funnel;
  readonly angle?: AdAngle;
  readonly avgRphLead: number;
  readonly avgRphChat?: number;
  readonly avgRphD3?: number;
  readonly sampleSize: number;
}

/** The `AgentMemory.performanceBaselines` / `VerdictDecisionEngine` lookup key: `${branch}-${funnel}-${angle}`. */
export function performanceBaselineKey(branch: Branch, funnel: Funnel, angle: AdAngle): string {
  return `${branch}-${funnel}-${angle}`;
}
