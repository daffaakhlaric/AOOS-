import { Branch, Funnel } from "@aos/meta-ads-connector";

import type { AgentMemory } from "../domain/entities/AgentMemory.js";
import { AdAngle } from "../domain/value-objects/AdAngle.js";
import { performanceBaselineKey } from "../domain/value-objects/PerformanceBaseline.js";

import { TOP_UNITS } from "./BusinessKnowledgeBase.js";

type AngleTable = Partial<Record<Branch, Partial<Record<string, ReadonlyArray<AdAngle>>>>>;

/**
 * The spec's exact `angleRanking` table, plus an explicit, tested default fallback to
 * `AdAngle.DP_RINGAN` for any branch/unit combination not listed (spec: "etc — default to
 * DP_RINGAN if no specific data"). `unit` keys are matched case-insensitively against the unit
 * name substring (e.g. "Xpander Cross 2019" matches the "Xpander" entry).
 */
const ANGLE_RANKING: AngleTable = {
  [Branch.BINTARO]: {
    XPANDER: [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA, AdAngle.QNA],
    BRIO: [AdAngle.DP_RINGAN, AdAngle.KREDIT_SYARIAH, AdAngle.DISCOVERY],
  },
  [Branch.CINERE]: {
    XPANDER: [AdAngle.GUDANGNYA, AdAngle.DP_RINGAN, AdAngle.QNA],
  },
};

const DEFAULT_RANKING: ReadonlyArray<AdAngle> = [AdAngle.DP_RINGAN];

/** Recommends creative angles for a unit + branch from DSS's historical MAAO performance data. */
export class AngleRecommender {
  /** Returns the full ranked angle list for `branch`/`unit`, falling back to `[DP_RINGAN]` when no specific data exists. */
  static rank(branch: Branch, unit: string): ReadonlyArray<AdAngle> {
    const unitKey = AngleRecommender.matchUnitKey(unit);
    const byBranch = ANGLE_RANKING[branch];
    if (!byBranch || !unitKey) {
      return DEFAULT_RANKING;
    }
    const ranking = byBranch[unitKey];
    return ranking ?? DEFAULT_RANKING;
  }

  /** Returns the single first-priority angle for `branch`/`unit`. `rank()` always returns a non-empty array (`DEFAULT_RANKING` has one member), so the first element is asserted rather than defaulted. */
  static recommend(branch: Branch, unit: string): AdAngle {
    return AngleRecommender.rank(branch, unit)[0] as AdAngle;
  }

  /**
   * AAOS-W1D-S1S2 (S1) — 3-tier angle selection, per the spec's `selectBestAngle` pseudocode:
   *   1. Historical ranking: the first `memory.topAngles` entry that has a `PerformanceBaseline`
   *      for `${branch}-${Funnel.CTWA}-${angle}` with `sampleSize >= 20` (spec hardcodes
   *      `Funnel.CTWA` in the lookup key — CTWA is DSS's dominant per-branch funnel, see
   *      `BusinessKnowledgeBase.MOBIX_LOCATIONS`).
   *   2. Static unit-specific fallback: `TOP_UNITS` entry matching `unit` (substring,
   *      case-insensitive) → its `bestAngles[0]`.
   *   3. Final fallback: `AdAngle.DP_RINGAN`.
   */
  static selectBestAngle(branch: Branch, unit: string, memory?: AgentMemory): AdAngle {
    if (memory) {
      for (const angle of memory.topAngles) {
        const key = performanceBaselineKey(branch, Funnel.CTWA, angle);
        const baseline = memory.performanceBaselines.get(key);
        if (baseline && baseline.sampleSize >= 20) {
          return angle;
        }
      }
    }

    const unitLower = unit.toLowerCase();
    const unitProfile = TOP_UNITS.find((u) => unitLower.includes(u.model.toLowerCase()));
    if (unitProfile) {
      return unitProfile.bestAngles[0] as AdAngle;
    }

    return AdAngle.DP_RINGAN;
  }

  private static matchUnitKey(unit: string): string | undefined {
    const upper = unit.toUpperCase();
    if (upper.includes("XPANDER")) {
      return "XPANDER";
    }
    if (upper.includes("BRIO")) {
      return "BRIO";
    }
    return undefined;
  }
}
