import { Verdict } from "@aos/meta-ads-connector";

import type { PerAdFinding } from "../types/AgentTypes.js";

/**
 * Identifies which ads' creatives work and which need refresh. `identifyWorstPerformer` treats an
 * *undefined* `rphD3` (no D3 conversions at all despite REFRESH-worthy frequency/spend) as
 * strictly worse than any defined, finite rate — sorted to the front — since "spending with zero
 * serious conversations" is a stronger refresh signal than "spending at a merely elevated rate".
 */
export class CreativeIntelligence {
  /** Returns the REFRESH-verdict finding most in need of a new creative, or `undefined` if none. */
  static identifyWorstPerformer(findings: ReadonlyArray<PerAdFinding>): PerAdFinding | undefined {
    const refreshCandidates = findings.filter((f) => f.verdict === Verdict.REFRESH);
    if (refreshCandidates.length === 0) {
      return undefined;
    }
    const sorted = [...refreshCandidates].sort((a, b) => {
      const rateA = a.rphD3IDR ?? Number.POSITIVE_INFINITY;
      const rateB = b.rphD3IDR ?? Number.POSITIVE_INFINITY;
      return rateB - rateA;
    });
    return sorted[0];
  }

  /** All REFRESH-verdict findings, ranked worst-first (same ordering as `identifyWorstPerformer`). */
  static rankRefreshCandidates(findings: ReadonlyArray<PerAdFinding>): ReadonlyArray<PerAdFinding> {
    return [...findings]
      .filter((f) => f.verdict === Verdict.REFRESH)
      .sort(
        (a, b) =>
          (b.rphD3IDR ?? Number.POSITIVE_INFINITY) - (a.rphD3IDR ?? Number.POSITIVE_INFINITY),
      );
  }
}
