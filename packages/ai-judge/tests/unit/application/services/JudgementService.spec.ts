import { describe, expect, it } from "vitest";

import { JudgementService } from "../../../../src/application/services/JudgementService.js";
import { DEFAULT_AI_JUDGE_CONFIG } from "../../../../src/config/AiJudgeConfig.js";
import { ClosingAttemptScorer } from "../../../../src/scorers/ClosingAttemptScorer.js";
import { HandoffQualityScorer } from "../../../../src/scorers/HandoffQualityScorer.js";
import { NaturalLanguageScorer } from "../../../../src/scorers/NaturalLanguageScorer.js";
import { ObjectionHandlingScorer } from "../../../../src/scorers/ObjectionHandlingScorer.js";
import { QualificationScorer } from "../../../../src/scorers/QualificationScorer.js";
import { ResponseLengthScorer } from "../../../../src/scorers/ResponseLengthScorer.js";
import { makeSimulationResult } from "../../../fixtures/simulationResultFixtures.js";

function makeService(clock: () => Date = () => new Date(2026, 0, 1)) {
  return new JudgementService(
    {
      naturalLanguage: new NaturalLanguageScorer(),
      qualification: new QualificationScorer(),
      objectionHandling: new ObjectionHandlingScorer(),
      closingAttempt: new ClosingAttemptScorer(),
      handoffQuality: new HandoffQualityScorer(),
      responseLength: new ResponseLengthScorer(),
    },
    DEFAULT_AI_JUDGE_CONFIG,
    clock,
  );
}

describe("JudgementService", () => {
  it("judge() runs all 6 scorers and assembles a JudgementResult", () => {
    const service = makeService();
    const result = service.judge(makeSimulationResult());
    expect(result.naturalLanguage.score.value).toBeGreaterThanOrEqual(0);
    expect(result.qualification.score.value).toBeGreaterThanOrEqual(0);
    expect(result.objectionHandling.score.value).toBeGreaterThanOrEqual(0);
    expect(result.closingAttempt.score.value).toBeGreaterThanOrEqual(0);
    expect(result.handoffQuality.score.value).toBeGreaterThanOrEqual(0);
    expect(result.responseLength.score.value).toBeGreaterThanOrEqual(0);
    expect(result.overallScore.value).toBeGreaterThanOrEqual(0);
    expect(result.overallScore.value).toBeLessThanOrEqual(100);
  });

  it("judgedAt uses the injected clock", () => {
    const fixed = new Date(2026, 5, 1);
    const service = makeService(() => fixed);
    const result = service.judge(makeSimulationResult());
    expect(result.judgedAt).toEqual(fixed);
  });

  it("defaults the clock to the current time when none is injected", () => {
    const service = new JudgementService(
      {
        naturalLanguage: new NaturalLanguageScorer(),
        qualification: new QualificationScorer(),
        objectionHandling: new ObjectionHandlingScorer(),
        closingAttempt: new ClosingAttemptScorer(),
        handoffQuality: new HandoffQualityScorer(),
        responseLength: new ResponseLengthScorer(),
      },
      DEFAULT_AI_JUDGE_CONFIG,
    );
    const before = Date.now();
    const result = service.judge(makeSimulationResult());
    const after = Date.now();
    expect(result.judgedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.judgedAt.getTime()).toBeLessThanOrEqual(after);
  });
});
