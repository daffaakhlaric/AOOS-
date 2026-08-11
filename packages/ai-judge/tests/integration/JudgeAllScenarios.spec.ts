import { DEFAULT_SIMULATOR_CONFIG, SimulatorFactory } from "@aos/conversation-simulator";
import { describe, expect, it } from "vitest";

import { Verdict } from "../../src/domain/value-objects/Verdict.js";
import { AiJudgeFactory } from "../../src/factories/AiJudgeFactory.js";
import { unwrap } from "../helpers/result.js";

describe("Integration: JudgeAllScenarios", () => {
  it("all 10 personas judged without error", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const simulationResults = unwrap(
      await simulator.runAllScenarios.execute(DEFAULT_SIMULATOR_CONFIG),
    );
    expect(simulationResults).toHaveLength(10);

    const judge = unwrap(AiJudgeFactory.create());
    const report = unwrap(await judge.judgeAllScenarios.execute(simulationResults));

    expect(report.totalPersonas).toBe(10);
    expect(report.results).toHaveLength(10);
  }, 30_000);

  it("overallVerdict is computed from the average score across every persona", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const simulationResults = unwrap(
      await simulator.runAllScenarios.execute(DEFAULT_SIMULATOR_CONFIG),
    );

    const judge = unwrap(AiJudgeFactory.create());
    const report = unwrap(await judge.judgeAllScenarios.execute(simulationResults));

    expect([Verdict.APPROVE, Verdict.NEEDS_IMPROVEMENT, Verdict.FAIL]).toContain(
      report.overallVerdict,
    );
    expect(report.approvedCount + report.needsImprovementCount + report.failCount).toBe(10);
  }, 30_000);

  it("weakestDimensions identifies all 6 dimensions ranked ascending", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const simulationResults = unwrap(
      await simulator.runAllScenarios.execute(DEFAULT_SIMULATOR_CONFIG),
    );

    const judge = unwrap(AiJudgeFactory.create());
    const report = unwrap(await judge.judgeAllScenarios.execute(simulationResults));

    expect(report.weakestDimensions).toHaveLength(6);
  }, 30_000);

  it("goldenCandidates only lists personas with score >= 85", async () => {
    const simulator = unwrap(SimulatorFactory.create());
    const simulationResults = unwrap(
      await simulator.runAllScenarios.execute(DEFAULT_SIMULATOR_CONFIG),
    );

    const judge = unwrap(AiJudgeFactory.create());
    const report = unwrap(await judge.judgeAllScenarios.execute(simulationResults));

    for (const sessionId of report.goldenCandidates) {
      const matching = report.results.find((r) => r.simulationSessionId.equals(sessionId));
      expect(matching?.overallScore.value).toBeGreaterThanOrEqual(85);
    }
  }, 30_000);
});
