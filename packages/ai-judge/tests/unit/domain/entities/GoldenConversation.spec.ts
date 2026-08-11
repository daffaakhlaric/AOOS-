import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { JudgementResultBuilder } from "../../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../../src/config/AiJudgeConfig.js";
import type { GoldenConversation } from "../../../../src/domain/entities/GoldenConversation.js";
import { DimensionName } from "../../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../../src/domain/value-objects/DimensionScoreValue.js";
import { makeSimulationResult } from "../../../fixtures/simulationResultFixtures.js";

function dim(dimension: DimensionName, value: number) {
  return { dimension, score: DimensionScoreValue.of(value), appliedRules: [] };
}

describe("GoldenConversation", () => {
  it("carries the simulation result, judgement result, savedAt, and tags together", () => {
    const simulationResult = makeSimulationResult();
    const judgementResult = JudgementResultBuilder.build({
      sessionId: SessionId.create("sim-1"),
      personaId: PersonaId.READY_BUYER,
      personaDifficulty: PersonaDifficulty.EASY,
      dimensions: {
        naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, 9),
        qualification: dim(DimensionName.QUALIFICATION, 9),
        objectionHandling: dim(DimensionName.OBJECTION_HANDLING, 9),
        closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, 9),
        handoffQuality: dim(DimensionName.HANDOFF_QUALITY, 9),
        responseLength: dim(DimensionName.RESPONSE_LENGTH, 9),
      },
      config: DEFAULT_AI_JUDGE_CONFIG,
      now: new Date(2026, 0, 1),
    });

    const golden: GoldenConversation = {
      id: "golden-1",
      personaId: PersonaId.READY_BUYER,
      simulationResult,
      judgementResult,
      savedAt: new Date(2026, 0, 1),
      tags: ["ready_buyer", "hot-lead"],
    };

    expect(golden.tags).toContain("hot-lead");
    expect(golden.judgementResult.isGoldenCandidate).toBe(true);
  });
});
