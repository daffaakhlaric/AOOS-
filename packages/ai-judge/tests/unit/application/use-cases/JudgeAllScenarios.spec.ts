import { PersonaId } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { AiJudgeFactory } from "../../../../src/factories/AiJudgeFactory.js";
import { makeSimulationResult } from "../../../fixtures/simulationResultFixtures.js";

describe("JudgeAllScenarios", () => {
  it("judges every persona without error and reports totals that add up", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const simulations = [
      makeSimulationResult({ personaId: PersonaId.READY_BUYER }),
      makeSimulationResult({ personaId: PersonaId.COLD_BUYER }),
      makeSimulationResult({ personaId: PersonaId.SYARIAH_BUYER }),
    ];
    const result = await factory.value.judgeAllScenarios.execute(simulations);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.totalPersonas).toBe(3);
    expect(
      result.value.approvedCount + result.value.needsImprovementCount + result.value.failCount,
    ).toBe(3);
    expect(result.value.results).toHaveLength(3);
  });

  it("weakestDimensions covers all 6 dimensions, sorted ascending by avgScore", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const result = await factory.value.judgeAllScenarios.execute([makeSimulationResult()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.weakestDimensions).toHaveLength(6);
    const scores = result.value.weakestDimensions.map((w) => w.avgScore);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it("goldenCandidates lists sessionIds of results with isGoldenCandidate=true", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const result = await factory.value.judgeAllScenarios.execute([makeSimulationResult()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const sessionId of result.value.goldenCandidates) {
      const matching = result.value.results.find((r) => r.simulationSessionId.equals(sessionId));
      expect(matching?.isGoldenCandidate).toBe(true);
    }
  });

  it("propagates the first failure instead of throwing", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const result = await factory.value.judgeAllScenarios.execute([
      makeSimulationResult({ messages: [] }),
    ]);
    expect(result.ok).toBe(false);
  });

  it("empty input -> totalPersonas 0, avgOverallScore 0, no golden candidates", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const result = await factory.value.judgeAllScenarios.execute([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.totalPersonas).toBe(0);
    expect(result.value.avgOverallScore).toBe(0);
    expect(result.value.goldenCandidates).toEqual([]);
  });
});
