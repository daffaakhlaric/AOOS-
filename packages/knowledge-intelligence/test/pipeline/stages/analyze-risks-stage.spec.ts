import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeRisksStage } from "../../../src/pipeline/stages/analyze-risks-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("AnalyzeRisksStage", () => {
  beforeEach(() => resetFixtureState());

  it("computes risk assessments and priority scores per item", () => {
    const clock = makeClock(1000);
    const items = [makeItem({ id: "a", lastUpdatedAt: 1000 })];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeRisksStage().execute(context);
    expect(context.riskAssessments?.get("a")).toBeDefined();
    expect(context.priorityScores?.get("a")).toBeDefined();
  });
});
