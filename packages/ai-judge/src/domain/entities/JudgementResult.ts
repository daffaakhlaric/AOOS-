import type { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";

import type { Feedback } from "../value-objects/Feedback.js";
import type { Grade } from "../value-objects/Grade.js";
import type { ImprovementSuggestion } from "../value-objects/ImprovementSuggestion.js";
import type { JudgementId } from "../value-objects/JudgementId.js";
import type { OverallScore } from "../value-objects/OverallScore.js";
import type { Verdict } from "../value-objects/Verdict.js";

import type { DimensionScore } from "./DimensionScore.js";

/** The full evaluation of one `SimulationResult` (spec "JudgementResult"). */
export interface JudgementResult {
  readonly id: JudgementId;
  readonly simulationSessionId: SessionId;
  readonly personaId: PersonaId;
  readonly personaDifficulty: PersonaDifficulty;
  readonly judgedAt: Date;

  // Per-dimension scores
  readonly naturalLanguage: DimensionScore;
  readonly qualification: DimensionScore;
  readonly objectionHandling: DimensionScore;
  readonly closingAttempt: DimensionScore;
  readonly handoffQuality: DimensionScore;
  readonly responseLength: DimensionScore;

  // Overall
  readonly overallScore: OverallScore;
  readonly grade: Grade;
  readonly verdict: Verdict;

  // Feedback
  readonly feedbackItems: ReadonlyArray<Feedback>;
  readonly improvementSuggestions: ReadonlyArray<ImprovementSuggestion>;
  readonly highlights: ReadonlyArray<string>;

  // Meta
  readonly isGoldenCandidate: boolean;
}
