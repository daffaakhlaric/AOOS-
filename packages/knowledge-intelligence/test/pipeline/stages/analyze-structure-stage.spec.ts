import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeStructureStage } from "../../../src/pipeline/stages/analyze-structure-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("AnalyzeStructureStage", () => {
  beforeEach(() => resetFixtureState());

  it("populates findings on the context", () => {
    const clock = makeClock(0);
    const items = [makeItem({ id: "a", hasSummary: false })];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeStructureStage().execute(context);
    expect(context.findings?.length).toBeGreaterThan(0);
  });
});
