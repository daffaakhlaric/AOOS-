import { PersonaDifficulty, PersonaId, SessionId } from "@aos/conversation-simulator";
import { LeadTemperature } from "@aos/sales-agent";
import { beforeEach, describe, expect, it } from "vitest";

import {
  GoldenDatasetService,
  resetGoldenConversationIdSequence,
} from "../../../../src/application/services/GoldenDatasetService.js";
import { JudgementResultBuilder } from "../../../../src/builders/JudgementResultBuilder.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../../src/config/AiJudgeConfig.js";
import { DimensionName } from "../../../../src/domain/value-objects/DimensionName.js";
import { DimensionScoreValue } from "../../../../src/domain/value-objects/DimensionScoreValue.js";
import { GoldenDatasetRegistry } from "../../../../src/registry/GoldenDatasetRegistry.js";
import { makeSimulationResult } from "../../../fixtures/simulationResultFixtures.js";

function dim(
  dimension: DimensionName,
  value: number,
  appliedRules: ReadonlyArray<{ rule: string; points: number; note: string }> = [],
) {
  return { dimension, score: DimensionScoreValue.of(value), appliedRules };
}

function highScoreJudgement(sessionId: string, objectionHandled: boolean) {
  return JudgementResultBuilder.build({
    sessionId: SessionId.create(sessionId),
    personaId: PersonaId.SYARIAH_BUYER,
    personaDifficulty: PersonaDifficulty.MEDIUM,
    dimensions: {
      naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, 9),
      qualification: dim(DimensionName.QUALIFICATION, 9),
      objectionHandling: dim(
        DimensionName.OBJECTION_HANDLING,
        9,
        objectionHandled ? [{ rule: "ENTERED_OBJECTION_STAGE", points: 4, note: "ok" }] : [],
      ),
      closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, 9),
      handoffQuality: dim(DimensionName.HANDOFF_QUALITY, 9),
      responseLength: dim(DimensionName.RESPONSE_LENGTH, 9),
    },
    config: DEFAULT_AI_JUDGE_CONFIG,
    now: new Date(2026, 0, 1),
  });
}

function lowScoreJudgement(sessionId: string) {
  return JudgementResultBuilder.build({
    sessionId: SessionId.create(sessionId),
    personaId: PersonaId.COLD_BUYER,
    personaDifficulty: PersonaDifficulty.EASY,
    dimensions: {
      naturalLanguage: dim(DimensionName.NATURAL_LANGUAGE, 2),
      qualification: dim(DimensionName.QUALIFICATION, 2),
      objectionHandling: dim(DimensionName.OBJECTION_HANDLING, 2),
      closingAttempt: dim(DimensionName.CLOSING_ATTEMPT, 2),
      handoffQuality: dim(DimensionName.HANDOFF_QUALITY, 2),
      responseLength: dim(DimensionName.RESPONSE_LENGTH, 2),
    },
    config: DEFAULT_AI_JUDGE_CONFIG,
    now: new Date(2026, 0, 1),
  });
}

describe("GoldenDatasetService", () => {
  beforeEach(() => {
    resetGoldenConversationIdSequence();
  });

  it("saves a high-scoring (golden-candidate) JudgementResult into the registry", () => {
    const registry = new GoldenDatasetRegistry();
    const service = new GoldenDatasetService(registry, () => new Date(2026, 0, 1));
    const simulationResult = makeSimulationResult({ personaId: PersonaId.SYARIAH_BUYER });
    const judgementResult = highScoreJudgement("sim-1", true);

    const saved = service.save(simulationResult, judgementResult);
    expect(saved.ok).toBe(true);
    expect(registry.size).toBe(1);
  });

  it("refuses to save a JudgementResult that is not a golden candidate", () => {
    const registry = new GoldenDatasetRegistry();
    const service = new GoldenDatasetService(registry);
    const simulationResult = makeSimulationResult({ personaId: PersonaId.COLD_BUYER });
    const judgementResult = lowScoreJudgement("sim-2");

    const saved = service.save(simulationResult, judgementResult);
    expect(saved.ok).toBe(false);
    expect(registry.size).toBe(0);
  });

  it("derives tags: personaId, hot-lead, handoff, objection-handled, plus any extra tags", () => {
    const registry = new GoldenDatasetRegistry();
    const service = new GoldenDatasetService(registry, () => new Date(2026, 0, 1));
    const simulationResult = makeSimulationResult({
      personaId: PersonaId.SYARIAH_BUYER,
      finalTemperature: LeadTemperature.HOT,
      handoffTriggered: true,
    });
    const judgementResult = highScoreJudgement("sim-3", true);

    const saved = service.save(simulationResult, judgementResult, ["syariah"]);
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.tags).toEqual(
        expect.arrayContaining([
          "syariah",
          PersonaId.SYARIAH_BUYER,
          "hot-lead",
          "handoff",
          "objection-handled",
        ]),
      );
    }
  });

  it("does not tag 'objection-handled' when the objection dimension never entered OBJECTION stage", () => {
    const registry = new GoldenDatasetRegistry();
    const service = new GoldenDatasetService(registry, () => new Date(2026, 0, 1));
    const simulationResult = makeSimulationResult({ personaId: PersonaId.READY_BUYER });
    const judgementResult = highScoreJudgement("sim-4", false);

    const saved = service.save(simulationResult, judgementResult);
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.tags).not.toContain("objection-handled");
    }
  });

  it("defaults the clock to the current time when none is injected", () => {
    const registry = new GoldenDatasetRegistry();
    const service = new GoldenDatasetService(registry);
    const simulationResult = makeSimulationResult({ personaId: PersonaId.SYARIAH_BUYER });
    const judgementResult = highScoreJudgement("sim-6", true);

    const before = Date.now();
    const saved = service.save(simulationResult, judgementResult);
    const after = Date.now();
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.savedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(saved.value.savedAt.getTime()).toBeLessThanOrEqual(after);
    }
  });

  it("getAll() returns everything saved so far", () => {
    const registry = new GoldenDatasetRegistry();
    const service = new GoldenDatasetService(registry, () => new Date(2026, 0, 1));
    service.save(
      makeSimulationResult({ personaId: PersonaId.SYARIAH_BUYER }),
      highScoreJudgement("sim-5", true),
    );
    expect(service.getAll()).toHaveLength(1);
  });
});
