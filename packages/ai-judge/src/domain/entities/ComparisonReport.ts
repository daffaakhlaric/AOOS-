import type { PersonaId } from "@aos/conversation-simulator";

import type { DimensionName } from "../value-objects/DimensionName.js";
import type { Grade } from "../value-objects/Grade.js";
import type { Verdict } from "../value-objects/Verdict.js";

import type { JudgementResult } from "./JudgementResult.js";

/**
 * The before/after delta for one dimension (spec leaves `CompareVersions`/`ComparisonReport`
 * design to this implementation — see docs/AAOS-AI-JUDGE-REPORT.md "CompareVersions design" for
 * the rationale). Positive `delta` means the "after" version scored higher on this dimension.
 */
export interface DimensionDelta {
  readonly dimension: DimensionName;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

/**
 * A before/after comparison of two `JudgementResult`s for the same persona — e.g. Jessy v1 vs
 * Jessy v2 after a refinement pass (spec "Responsibilities": "Compare Jessy versions
 * (before/after refinement)"). Immutable, purely derived from its two inputs (no I/O).
 */
export interface ComparisonReport {
  readonly personaId: PersonaId;
  readonly before: JudgementResult;
  readonly after: JudgementResult;
  readonly comparedAt: Date;

  readonly overallScoreDelta: number;
  readonly gradeBefore: Grade;
  readonly gradeAfter: Grade;
  readonly verdictBefore: Verdict;
  readonly verdictAfter: Verdict;
  readonly verdictImproved: boolean;
  readonly verdictRegressed: boolean;

  readonly dimensionDeltas: ReadonlyArray<DimensionDelta>;
  readonly improvedDimensions: ReadonlyArray<DimensionName>;
  readonly regressedDimensions: ReadonlyArray<DimensionName>;
  readonly unchangedDimensions: ReadonlyArray<DimensionName>;

  readonly summary: string;
}
