import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeQualityStage } from "../../../src/pipeline/stages/analyze-quality-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("AnalyzeQualityStage", () => {
  beforeEach(() => resetFixtureState());

  it("computes a quality score per item", () => {
    const clock = makeClock(0);
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeQualityStage().execute(context);
    expect(context.qualityScores?.size).toBe(2);
    expect(context.qualityScores?.get("a")).toBeDefined();
  });
});
