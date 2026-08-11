import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { JudgementResultBuilder } from "../../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../../src/config/AiJudgeConfig.js";
import { DimensionName } from "../../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../../src/domain/value-objects/DimensionScoreValue.js";
import { Grade } from "../../../../src/domain/value-objects/Grade.js";
import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";

function dim(dimension: DimensionName, value: number) {
  return { dimension, score: DimensionScoreValue.of(value), appliedRules: [] };
}

describe("JudgementResult", () => {
  it("carries every field the spec's interface declares", () => {
    const result = JudgementResultBuilder.build({
      sessionId: SessionId.create("sim-1"),
      personaId: PersonaId.READY_BUYER,
      personaDifficulty: PersonaDifficulty.EASY,
      dimensions: {
        naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, 8),
        qualification: dim(DimensionName.QUALIFICATION, 7),
        objectionHandling: dim(DimensionName.OBJECTION_HANDLING, 10),
        closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, 9),
        handoffQuality: dim(DimensionName.HANDOFF_QUALITY, 10),
        responseLength: dim(DimensionName.RESPONSE_LENGTH, 9),
      },
      config: DEFAULT_AI_JUDGE_CONFIG,
      now: new Date(2026, 0, 1),
    });

    expect(result.id.toString()).toContain("judgement-sim-1");
    expect(result.simulationSessionId.toString()).toBe("sim-1");
    expect(result.personaId).toBe(PersonaId.READY_BUYER);
    expect(result.personaDifficulty).toBe(PersonaDifficulty.EASY);
    expect(result.judgedAt).toEqual(new Date(2026, 0, 1));
    expect(result.overallScore.value).toBeCloseTo(85.5, 10);
    expect(result.grade).toBe(Grade.B_PLUS);
    expect(result.verdict).toBe(Verdict.APPROVE);
    expect(result.isGoldenCandidate).toBe(true);
    expect(Array.isArray(result.feedbackItems)).toBe(true);
    expect(Array.isArray(result.improvementSuggestions)).toBe(true);
    expect(Array.isArray(result.highlights)).toBe(true);
  });
});
