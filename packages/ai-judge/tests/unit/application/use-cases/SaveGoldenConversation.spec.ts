import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { GoldenDatasetService } from "../../../../src/application/services/GoldenDatasetService.js";
import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";
import { SaveGoldenConversation } from "../../../../src/application/use-cases/SaveGoldenConversation.js";
import { JudgementResultBuilder } from "../../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../../src/config/AiJudgeConfig.js";
import { AiJudgeEvents } from "../../../../src/domain/events/AiJudgeEvents.js";
import { DimensionName } from "../../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../../src/domain/value-objects/DimensionScoreValue.js";
import { GoldenDatasetRegistry } from "../../../../src/registry/GoldenDatasetRegistry.js";
import { makeSimulationResult } from "../../../fixtures/simulationResultFixtures.js";

function dim(dimension: DimensionName, value: number) {
  return { dimension, score: DimensionScoreValue.of(value), appliedRules: [] };
}

function judgementAt(value: number, sessionId: string) {
  return JudgementResultBuilder.build({
    sessionId: SessionId.create(sessionId),
    personaId: PersonaId.READY_BUYER,
    personaDifficulty: PersonaDifficulty.EASY,
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

function makeUseCase(publisher: ObservablePublisher) {
  const registry = new GoldenDatasetRegistry();
  const goldenDatasetService = new GoldenDatasetService(registry, () => new Date(2026, 0, 1));
  const events = new AiJudgeEvents(publisher);
  return {
    useCase: new SaveGoldenConversation(goldenDatasetService, events, DEFAULT_AI_JUDGE_CONFIG),
    registry,
  };
}

describe("SaveGoldenConversation", () => {
  it("saves a golden-candidate JudgementResult and publishes GoldenConversationSaved", async () => {
    const publisher = new ObservablePublisher();
    const { useCase, registry } = makeUseCase(publisher);

    const simulationResult = makeSimulationResult({ personaId: PersonaId.READY_BUYER });
    const judgementResult = judgementAt(9, "sim-golden");

    const saved = await useCase.execute(simulationResult, judgementResult, ["extra-tag"]);
    expect(saved.ok).toBe(true);
    expect(registry.size).toBe(1);
    expect(publisher.published.some((e) => e.type === "aaos.judge.golden-conversation.saved")).toBe(
      true,
    );
  });

  it("propagates the GoldenDatasetService failure without publishing when the result isn't golden", async () => {
    const publisher = new ObservablePublisher();
    const { useCase, registry } = makeUseCase(publisher);

    const simulationResult = makeSimulationResult({ personaId: PersonaId.COLD_BUYER });
    const judgementResult = judgementAt(2, "sim-not-golden");

    const saved = await useCase.execute(simulationResult, judgementResult);
    expect(saved.ok).toBe(false);
    expect(registry.size).toBe(0);
    expect(publisher.published.some((e) => e.type === "aaos.judge.golden-conversation.saved")).toBe(
      false,
    );
  });
});
