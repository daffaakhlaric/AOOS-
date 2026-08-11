import type { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";

import type { AiJudgeConfig } from "../config/AiJudgeConfig.js";
import type { DimensionScore } from "../domain/entities/DimensionScore.js";
import type { JudgementResult } from "../domain/entities/JudgementResult.js";
import { ALL_DIMENSION_NAMES, DimensionName } from "../domain/value-objects/DimensionName.js";
import type { Feedback } from "../domain/value-objects/Feedback.js";
import { gradeFromScore } from "../domain/value-objects/Grade.js";
import type { ImprovementSuggestion } from "../domain/value-objects/ImprovementSuggestion.js";
import { JudgementId } from "../domain/value-objects/JudgementId.js";
import { OverallScore } from "../domain/value-objects/OverallScore.js";
import { verdictFromScore } from "../domain/value-objects/Verdict.js";

/** All 6 `DimensionScore`s, keyed the same as `JudgementResult`'s per-dimension fields. */
export interface DimensionScores {
  readonly naturalLanguage: DimensionScore;
  readonly qualification: DimensionScore;
  readonly objectionHandling: DimensionScore;
  readonly closingAttempt: DimensionScore;
  readonly handoffQuality: DimensionScore;
  readonly responseLength: DimensionScore;
}

export interface JudgementResultBuilderInput {
  readonly sessionId: SessionId;
  readonly personaId: PersonaId;
  readonly personaDifficulty: PersonaDifficulty;
  readonly dimensions: DimensionScores;
  readonly config: AiJudgeConfig;
  readonly now: Date;
}

const HIGHLIGHT_THRESHOLD = 8;
const SUGGESTION_THRESHOLD = 7;

const DIMENSION_LABELS: Readonly<Record<DimensionName, string>> = {
  [DimensionName.NATURAL_LANGUAGE]: "Natural Language",
  [DimensionName.QUALIFICATION]: "Qualification",
  [DimensionName.OBJECTION_HANDLING]: "Objection Handling",
  [DimensionName.CLOSING_ATTEMPT]: "Closing Attempt",
  [DimensionName.HANDOFF_QUALITY]: "Handoff Quality",
  [DimensionName.RESPONSE_LENGTH]: "Response Length",
};

/** Assembles a `JudgementResult` from 6 already-computed `DimensionScore`s (spec "builders/JudgementResultBuilder.ts"). Pure — no I/O, no randomness. */
export class JudgementResultBuilder {
  static build(input: JudgementResultBuilderInput): JudgementResult {
    const { dimensions, config } = input;
    const overallScore = OverallScore.fromDimensions(
      {
        naturalLanguage: dimensions.naturalLanguage.score.value,
        qualification: dimensions.qualification.score.value,
        objectionHandling: dimensions.objectionHandling.score.value,
        closingAttempt: dimensions.closingAttempt.score.value,
        handoffQuality: dimensions.handoffQuality.score.value,
        responseLength: dimensions.responseLength.score.value,
      },
      config.weights,
    );
    const grade = gradeFromScore(overallScore.value);
    const verdict = verdictFromScore(overallScore.value);
    const isGoldenCandidate = overallScore.value >= config.goldenThreshold;

    const allDimensions = [
      dimensions.naturalLanguage,
      dimensions.qualification,
      dimensions.objectionHandling,
      dimensions.closingAttempt,
      dimensions.handoffQuality,
      dimensions.responseLength,
    ];

    const feedbackItems = JudgementResultBuilder.buildFeedback(allDimensions);
    const improvementSuggestions = JudgementResultBuilder.buildSuggestions(allDimensions);
    const highlights = JudgementResultBuilder.buildHighlights(allDimensions);

    return {
      id: JudgementId.generate(input.sessionId.toString(), input.now),
      simulationSessionId: input.sessionId,
      personaId: input.personaId,
      personaDifficulty: input.personaDifficulty,
      judgedAt: input.now,
      naturalLanguage: dimensions.naturalLanguage,
      qualification: dimensions.qualification,
      objectionHandling: dimensions.objectionHandling,
      closingAttempt: dimensions.closingAttempt,
      handoffQuality: dimensions.handoffQuality,
      responseLength: dimensions.responseLength,
      overallScore,
      grade,
      verdict,
      feedbackItems,
      improvementSuggestions,
      highlights,
      isGoldenCandidate,
    };
  }

  private static buildFeedback(dimensions: ReadonlyArray<DimensionScore>): ReadonlyArray<Feedback> {
    const items: Feedback[] = [];
    for (const dimension of dimensions) {
      for (const rule of dimension.appliedRules) {
        if (rule.points < 0) {
          items.push({ dimension: dimension.dimension, message: rule.note });
        }
      }
    }
    return items;
  }

  private static buildSuggestions(
    dimensions: ReadonlyArray<DimensionScore>,
  ): ReadonlyArray<ImprovementSuggestion> {
    const suggestions: ImprovementSuggestion[] = [];
    for (const dimension of dimensions) {
      if (dimension.score.value < SUGGESTION_THRESHOLD) {
        const priority =
          dimension.score.value < 4 ? "HIGH" : dimension.score.value < 6 ? "MEDIUM" : "LOW";
        suggestions.push({
          dimension: dimension.dimension,
          priority,
          suggestion: `Tingkatkan skor ${DIMENSION_LABELS[dimension.dimension]} (saat ini ${dimension.score.value}/10).`,
        });
      }
    }
    return suggestions;
  }

  private static buildHighlights(dimensions: ReadonlyArray<DimensionScore>): ReadonlyArray<string> {
    const highlights: string[] = [];
    for (const dimension of dimensions) {
      if (dimension.score.value >= HIGHLIGHT_THRESHOLD) {
        highlights.push(
          `${DIMENSION_LABELS[dimension.dimension]}: ${dimension.score.value}/10 — solid.`,
        );
      }
    }
    return highlights;
  }
}

/** Re-exported so callers can iterate dimensions in canonical order without importing `DimensionName` separately. */
export { ALL_DIMENSION_NAMES };
