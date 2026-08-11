import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { JudgementResultBuilder } from "../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../src/config/AiJudgeConfig.js";
import { DimensionName } from "../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../src/domain/value-objects/DimensionScoreValue.js";

function dim(
  dimension: DimensionName,
  value: number,
  appliedRules: ReadonlyArray<{ rule: string; points: number; note: string }> = [],
) {
  return { dimension, score: DimensionScoreValue.of(value), appliedRules };
}

function buildWith(overrides: Partial<Record<DimensionName, number>> = {}) {
  const values: Record<DimensionName, number> = {
    [DimensionName.NATURAL_LANGUAGE]: 8,
    [DimensionName.QUALIFICATION]: 8,
    [DimensionName.OBJECTION_HANDLING]: 8,
    [DimensionName.CLOSING_ATTEMPT]: 8,
    [DimensionName.HANDOFF_QUALITY]: 8,
    [DimensionName.RESPONSE_LENGTH]: 8,
    ...overrides,
  };
  return JudgementResultBuilder.build({
    sessionId: SessionId.create("sim-1"),
    personaId: PersonaId.READY_BUYER,
    personaDifficulty: PersonaDifficulty.EASY,
    dimensions: {
      naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, values[DimensionName.NATURAL_LANGUAGE]),
      qualification: dim(DimensionName.QUALIFICATION, values[DimensionName.QUALIFICATION]),
      objectionHandling: dim(
        DimensionName.OBJECTION_HANDLING,
        values[DimensionName.OBJECTION_HANDLING],
      ),
      closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, values[DimensionName.CLOSING_ATTEMPT]),
      handoffQuality: dim(DimensionName.HANDOFF_QUALITY, values[DimensionName.HANDOFF_QUALITY]),
      responseLength: dim(DimensionName.RESPONSE_LENGTH, values[DimensionName.RESPONSE_LENGTH]),
    },
    config: DEFAULT_AI_JUDGE_CONFIG,
    now: new Date(2026, 0, 1),
  });
}

describe("JudgementResultBuilder", () => {
  it("golden_threshold pinned: overallScore >= 85 -> isGoldenCandidate true", () => {
    const result = buildWith({
      [DimensionName.NATURAL_LANGUAGE]: 8,
      [DimensionName.QUALIFICATION]: 7,
      [DimensionName.OBJECTION_HANDLING]: 10,
      [DimensionName.CLOSING_ATTEMPT]: 9,
      [DimensionName.HANDOFF_QUALITY]: 10,
      [DimensionName.RESPONSE_LENGTH]: 9,
    });
    expect(result.overallScore.value).toBeCloseTo(85.5, 10);
    expect(result.isGoldenCandidate).toBe(true);
  });

  it("golden_threshold pinned: overallScore 84.9 -> isGoldenCandidate false", () => {
    const result = JudgementResultBuilder.build({
      sessionId: SessionId.create("sim-1"),
      personaId: PersonaId.READY_BUYER,
      personaDifficulty: PersonaDifficulty.EASY,
      dimensions: {
        naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, 8),
        qualification: dim(DimensionName.QUALIFICATION, 8),
        objectionHandling: dim(DimensionName.OBJECTION_HANDLING, 9.933333333333334),
        closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, 9),
        handoffQuality: dim(DimensionName.HANDOFF_QUALITY, 8),
        responseLength: dim(DimensionName.RESPONSE_LENGTH, 8),
      },
      config: DEFAULT_AI_JUDGE_CONFIG,
      now: new Date(2026, 0, 1),
    });
    expect(result.overallScore.value).toBeCloseTo(84.9, 5);
    expect(result.isGoldenCandidate).toBe(false);
  });

  it("negative appliedRules become feedbackItems, tagged with their dimension", () => {
    const result = JudgementResultBuilder.build({
      sessionId: SessionId.create("sim-1"),
      personaId: PersonaId.READY_BUYER,
      personaDifficulty: PersonaDifficulty.EASY,
      dimensions: {
        naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, 5, [
          { rule: "TOO_LONG", points: -3, note: "Pesan turn ke-3 terlalu panjang (287 karakter)." },
        ]),
        qualification: dim(DimensionName.QUALIFICATION, 8),
        objectionHandling: dim(DimensionName.OBJECTION_HANDLING, 10),
        closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, 9),
        handoffQuality: dim(DimensionName.HANDOFF_QUALITY, 10),
        responseLength: dim(DimensionName.RESPONSE_LENGTH, 9),
      },
      config: DEFAULT_AI_JUDGE_CONFIG,
      now: new Date(2026, 0, 1),
    });
    expect(result.feedbackItems).toHaveLength(1);
    expect(result.feedbackItems[0]?.dimension).toBe(DimensionName.NATURAL_LANGUAGE);
    expect(result.feedbackItems[0]?.message).toContain("287 karakter");
  });

  it("dimensions scoring < 7 produce a prioritized improvement suggestion", () => {
    const result = buildWith({ [DimensionName.QUALIFICATION]: 3 });
    const suggestion = result.improvementSuggestions.find(
      (s) => s.dimension === DimensionName.QUALIFICATION,
    );
    expect(suggestion).toBeDefined();
    expect(suggestion?.priority).toBe("HIGH");
  });

  it("dimensions scoring >= 8 produce a highlight", () => {
    const result = buildWith();
    expect(result.highlights.length).toBeGreaterThan(0);
    expect(result.highlights.some((h) => h.includes("Natural Language"))).toBe(true);
  });

  it("no negative applied rules -> no feedback items", () => {
    const result = buildWith();
    expect(result.feedbackItems).toEqual([]);
  });

  it("JudgementId is generated deterministically from sessionId + now + sequence", () => {
    const result = buildWith();
    expect(result.id.toString()).toContain("judgement-sim-1");
  });
});
