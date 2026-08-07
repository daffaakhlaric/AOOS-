import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeRelationshipsStage } from "../../../src/pipeline/stages/analyze-relationships-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("AnalyzeRelationshipsStage", () => {
  beforeEach(() => resetFixtureState());

  it("populates relationships on the context", () => {
    const clock = makeClock(0);
    const items = [
      makeItem({ id: "a", tags: ["x", "y"] }),
      makeItem({ id: "b", tags: ["x", "y"] }),
    ];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeRelationshipsStage().execute(context);
    expect(context.relationships).toHaveLength(1);
  });
});
