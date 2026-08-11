import type { SessionId } from "@aos/conversation-simulator";

import type { Verdict } from "../value-objects/Verdict.js";

import type { JudgementResult } from "./JudgementResult.js";

/** One dimension's average score across every judged persona, weakest first (spec "JudgeAllScenarios Output"). */
export interface WeakestDimension {
  readonly dimension: string;
  readonly avgScore: number;
}

/** The full-workspace judgement report for `JudgeAllScenarios` (spec "JudgeAllScenarios Output"). */
export interface AllScenariosReport {
  readonly judgedAt: Date;
  readonly totalPersonas: number;
  readonly approvedCount: number;
  readonly needsImprovementCount: number;
  readonly failCount: number;

  readonly overallVerdict: Verdict;
  readonly avgOverallScore: number;

  readonly results: ReadonlyArray<JudgementResult>;

  readonly weakestDimensions: ReadonlyArray<WeakestDimension>;

  readonly topPriorities: ReadonlyArray<string>;

  readonly goldenCandidates: ReadonlyArray<SessionId>;
}
