import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeSimilarityStage } from "../../../src/pipeline/stages/analyze-similarity-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("AnalyzeSimilarityStage", () => {
  beforeEach(() => resetFixtureState());

  it("populates the similarity matrix, duplicates, and near-duplicates", () => {
    const clock = makeClock(0);
    const items = [
      makeItem({ id: "a", tags: ["x", "y"] }),
      makeItem({ id: "b", tags: ["x", "y"] }),
      makeItem({ id: "c", tags: ["p", "q", "r"] }),
      makeItem({ id: "d", tags: ["p", "q", "r", "s"] }),
    ];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeSimilarityStage().execute(context);
    expect(context.similarityMatrix?.entries.length).toBeGreaterThan(0);
    expect(context.duplicates).toHaveLength(1);
    expect(context.nearDuplicates).toHaveLength(1);
  });
});
