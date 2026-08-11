import { describe, expect, it } from "vitest";

import { ObservablePublisher } from "../../../src/application/services/ObservablePublisher.js";
import { AiJudgeFactory } from "../../../src/factories/AiJudgeFactory.js";
import { makeSimulationResult } from "../../fixtures/simulationResultFixtures.js";

describe("AiJudgeFactory", () => {
  it("create() with no options wires all 5 public use cases plus the registry/config/service", () => {
    const result = AiJudgeFactory.create();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.judgeConversation).toBeDefined();
    expect(result.value.judgeAllScenarios).toBeDefined();
    expect(result.value.saveGoldenConversation).toBeDefined();
    expect(result.value.compareVersions).toBeDefined();
    expect(result.value.getGoldenDataset).toBeDefined();
    expect(result.value.judgementService).toBeDefined();
    expect(result.value.goldenDatasetRegistry).toBeDefined();
    expect(result.value.config).toEqual(
      expect.objectContaining({ approveThreshold: 80, goldenThreshold: 85 }),
    );
  });

  it("accepts an injected publisher instead of creating its own", () => {
    const publisher = new ObservablePublisher();
    const result = AiJudgeFactory.create({ publisher });
    expect(result.ok).toBe(true);
  });

  it("accepts custom config overrides", () => {
    const result = AiJudgeFactory.create({ config: { approveThreshold: 70, goldenThreshold: 90 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.config.approveThreshold).toBe(70);
    expect(result.value.config.goldenThreshold).toBe(90);
  });

  it("returns an err Result when config validation fails", () => {
    const result = AiJudgeFactory.create({ config: { weights: { naturalLanguage: 0.9 } } });
    expect(result.ok).toBe(false);
  });

  it("two create() calls produce fully isolated registries", async () => {
    const first = AiJudgeFactory.create();
    const second = AiJudgeFactory.create();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.goldenDatasetRegistry).not.toBe(second.value.goldenDatasetRegistry);
  });

  it("accepts an injected clock for deterministic judgedAt timestamps", async () => {
    const fixed = new Date(2026, 2, 3);
    const result = AiJudgeFactory.create({ clock: () => fixed });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const judged = await result.value.judgeConversation.execute(makeSimulationResult());
    expect(judged.ok).toBe(true);
    if (judged.ok) {
      expect(judged.value.judgedAt).toEqual(fixed);
    }
  });
});
