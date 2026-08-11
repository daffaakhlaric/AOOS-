import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { ComparisonReportBuilder } from "../../../../src/builders/ComparisonReportBuilder.js";
import { JudgementResultBuilder } from "../../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../../src/config/AiJudgeConfig.js";
import { DimensionName } from "../../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../../src/domain/value-objects/DimensionScoreValue.js";

function dim(dimension: DimensionName, value: number) {
  return { dimension, score: DimensionScoreValue.of(value), appliedRules: [] };
}

function build(sessionId: string, value: number) {
  return JudgementResultBuilder.build({
    sessionId: SessionId.create(sessionId),
    personaId: PersonaId.KREDIT_BUYER,
    personaDifficulty: PersonaDifficulty.MEDIUM,
    dimensions: {
      naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, value),
      qualification: dim(DimensionName.QUALIFICATION, value),
      objectionHandling: dim(DimensionName.OBJECTION_HANDLING, value),
      closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, value),
      handoffQuality: dim(DimensionName.HANDOFF_QUALITY, value),
      responseLength: dim(DimensionName.RESPONSE_LENGTH, value),
    },
    config: DEFAULT_AI_JUDGE_CONFIG,
    now: new Date(2026, 0, 1),
  });
}

describe("ComparisonReport", () => {
  it("carries before/after JudgementResults, deltas, and a personaId", () => {
    const before = build("s1", 5);
    const after = build("s2", 8);
    const report = ComparisonReportBuilder.build(before, after, new Date(2026, 0, 1));

    expect(report.personaId).toBe(PersonaId.KREDIT_BUYER);
    expect(report.before).toBe(before);
    expect(report.after).toBe(after);
    expect(report.dimensionDeltas).toHaveLength(6);
  });
});
