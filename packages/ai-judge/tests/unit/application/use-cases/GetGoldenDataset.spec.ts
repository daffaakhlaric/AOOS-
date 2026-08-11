import { describe, expect, it } from "vitest";

import { AiJudgeFactory } from "../../../../src/factories/AiJudgeFactory.js";
import { makeSimulationResult } from "../../../fixtures/simulationResultFixtures.js";

describe("GetGoldenDataset", () => {
  it("returns an empty list when nothing has been saved", () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    expect(factory.value.getGoldenDataset.execute()).toEqual([]);
  });

  it("returns everything SaveGoldenConversation has saved", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const simulationResult = makeSimulationResult();
    const judged = await factory.value.judgeConversation.execute(simulationResult);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;

    if (judged.value.isGoldenCandidate) {
      await factory.value.saveGoldenConversation.execute(simulationResult, judged.value);
      expect(factory.value.getGoldenDataset.execute()).toHaveLength(1);
    } else {
      expect(factory.value.getGoldenDataset.execute()).toHaveLength(0);
    }
  });
});
