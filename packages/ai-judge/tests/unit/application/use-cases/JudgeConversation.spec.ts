import { describe, expect, it } from "vitest";

import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";
import { AiJudgeFactory } from "../../../../src/factories/AiJudgeFactory.js";
import { makeSimulationResult } from "../../../fixtures/simulationResultFixtures.js";

describe("JudgeConversation", () => {
  it("produces a JudgementResult for a valid SimulationResult", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const result = await factory.value.judgeConversation.execute(makeSimulationResult());
    expect(result.ok).toBe(true);
  });

  it("rejects a SimulationResult with no messages", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const result = await factory.value.judgeConversation.execute(
      makeSimulationResult({ messages: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("no messages");
    }
  });

  it("publishes a JudgementCompleted event on success", async () => {
    const publisher = new ObservablePublisher();
    const factory = AiJudgeFactory.create({ publisher });
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    await factory.value.judgeConversation.execute(makeSimulationResult());
    expect(publisher.published.some((e) => e.type === "aaos.judge.judgement.completed")).toBe(true);
  });
});
