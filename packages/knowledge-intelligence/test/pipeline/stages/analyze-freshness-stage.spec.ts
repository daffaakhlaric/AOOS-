import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeFreshnessStage } from "../../../src/pipeline/stages/analyze-freshness-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("AnalyzeFreshnessStage", () => {
  beforeEach(() => resetFixtureState());

  it("computes a freshness score per item", () => {
    const clock = makeClock(1000);
    const items = [makeItem({ id: "a", lastUpdatedAt: 1000 })];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeFreshnessStage().execute(context);
    expect(context.freshnessScores?.get("a")?.value).toBe(100);
  });
});
