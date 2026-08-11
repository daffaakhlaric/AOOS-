import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { JudgementResultBuilder } from "../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../src/config/AiJudgeConfig.js";
import type { GoldenConversation } from "../../../src/domain/entities/GoldenConversation.js";
import { DimensionName } from "../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../src/domain/value-objects/DimensionScoreValue.js";
import { GoldenDatasetRegistry } from "../../../src/registry/GoldenDatasetRegistry.js";
import { makeSimulationResult } from "../../fixtures/simulationResultFixtures.js";

function dim(dimension: DimensionName, value: number) {
  return { dimension, score: DimensionScoreValue.of(value), appliedRules: [] };
}

function makeGolden(id: string, personaId: PersonaId = PersonaId.READY_BUYER): GoldenConversation {
  const simulationResult = makeSimulationResult({ personaId });
  const judgementResult = JudgementResultBuilder.build({
    sessionId: SessionId.create(id),
    personaId,
    personaDifficulty: PersonaDifficulty.EASY,
    dimensions: {
      naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, 9),
      qualification: dim(DimensionName.QUALIFICATION, 9),
      objectionHandling: dim(DimensionName.OBJECTION_HANDLING, 10),
      closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, 9),
      handoffQuality: dim(DimensionName.HANDOFF_QUALITY, 10),
      responseLength: dim(DimensionName.RESPONSE_LENGTH, 9),
    },
    config: DEFAULT_AI_JUDGE_CONFIG,
    now: new Date(2026, 0, 1),
  });
  return {
    id,
    personaId,
    simulationResult,
    judgementResult,
    savedAt: new Date(2026, 0, 1),
    tags: [personaId],
  };
}

describe("GoldenDatasetRegistry", () => {
  it("add() then getAll() returns the stored conversation", () => {
    const registry = new GoldenDatasetRegistry();
    const golden = makeGolden("g1");
    registry.add(golden);
    expect(registry.getAll()).toEqual([golden]);
  });

  it("findById() returns the matching conversation, undefined otherwise", () => {
    const registry = new GoldenDatasetRegistry();
    const golden = makeGolden("g1");
    registry.add(golden);
    expect(registry.findById("g1")).toBe(golden);
    expect(registry.findById("missing")).toBeUndefined();
  });

  it("findByPersonaId() filters by persona", () => {
    const registry = new GoldenDatasetRegistry();
    registry.add(makeGolden("g1", PersonaId.READY_BUYER));
    registry.add(makeGolden("g2", PersonaId.SYARIAH_BUYER));
    expect(registry.findByPersonaId(PersonaId.READY_BUYER)).toHaveLength(1);
  });

  it("adding with the same id overwrites the previous entry", () => {
    const registry = new GoldenDatasetRegistry();
    registry.add(makeGolden("g1", PersonaId.READY_BUYER));
    registry.add(makeGolden("g1", PersonaId.SYARIAH_BUYER));
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getAll()[0]?.personaId).toBe(PersonaId.SYARIAH_BUYER);
  });

  it("clear() empties the registry", () => {
    const registry = new GoldenDatasetRegistry();
    registry.add(makeGolden("g1"));
    registry.clear();
    expect(registry.getAll()).toEqual([]);
  });

  it("size getter reflects the number of stored conversations", () => {
    const registry = new GoldenDatasetRegistry();
    expect(registry.size).toBe(0);
    registry.add(makeGolden("g1"));
    expect(registry.size).toBe(1);
  });
});
