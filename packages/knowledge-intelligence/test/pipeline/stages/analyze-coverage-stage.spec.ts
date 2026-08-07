import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeCoverageStage } from "../../../src/pipeline/stages/analyze-coverage-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("AnalyzeCoverageStage", () => {
  beforeEach(() => resetFixtureState());

  it("computes coverage score and a gap report from taxonomy/adjacency", () => {
    const clock = makeClock(0);
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const context: PipelineContext = {
      items,
      taxonomy: [
        { topic: "t1", covered: true, itemCount: 1 },
        { topic: "t2", covered: false, itemCount: 0 },
      ],
      adjacency: { a: ["b"] },
      runId: "r",
      ...makeServices(clock, makeConfig()),
    };
    new AnalyzeCoverageStage().execute(context);
    expect(context.coverageScore?.value).toBe(50);
    expect(context.gapReport?.gaps).toHaveLength(1);
    expect(context.gapReport?.orphans).toHaveLength(0);
  });

  it("defaults to empty taxonomy/adjacency when omitted", () => {
    const clock = makeClock(0);
    const items = [makeItem({ id: "a" })];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeCoverageStage().execute(context);
    expect(context.coverageScore?.value).toBe(100);
    expect(context.gapReport?.orphans).toHaveLength(1);
  });
});
