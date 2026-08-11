import { describe, expect, it } from "vitest";

import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";
import { AiJudgeFactory } from "../../../../src/factories/AiJudgeFactory.js";
import { makeSimulationResult } from "../../../fixtures/simulationResultFixtures.js";

describe("AllScenariosReport", () => {
  it("has every field the spec's interface declares", async () => {
    const factory = AiJudgeFactory.create();
    expect(factory.ok).toBe(true);
    if (!factory.ok) return;

    const result = await factory.value.judgeAllScenarios.execute([makeSimulationResult()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const report = result.value;
    expect(report.judgedAt).toBeInstanceOf(Date);
    expect(typeof report.totalPersonas).toBe("number");
    expect(typeof report.approvedCount).toBe("number");
    expect(typeof report.needsImprovementCount).toBe("number");
    expect(typeof report.failCount).toBe("number");
    expect(Object.values(Verdict)).toContain(report.overallVerdict);
    expect(typeof report.avgOverallScore).toBe("number");
    expect(Array.isArray(report.results)).toBe(true);
    expect(Array.isArray(report.weakestDimensions)).toBe(true);
    expect(Array.isArray(report.topPriorities)).toBe(true);
    expect(Array.isArray(report.goldenCandidates)).toBe(true);
  });
});
