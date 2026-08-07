import { beforeEach, describe, expect, it } from "vitest";

import { AnalyzeChangesStage } from "../../src/pipeline/stages/analyze-changes-stage.js";
import { ChangeMagnitude } from "../../src/types/change-magnitude.js";
import { resetFixtureState } from "../helpers/fixtures.js";
import { makeContext } from "../helpers/pipeline-helpers.js";

describe("AnalyzeChangesStage", () => {
  beforeEach(resetFixtureState);

  it("classifies based on context.detection when present", () => {
    const context = makeContext();
    context.detection = { changed: true, reasons: ["checksum_changed"] };
    const result = new AnalyzeChangesStage().execute(context);
    expect(result.changeMagnitude).toBe(ChangeMagnitude.Content);
  });

  it("defaults to a changed-with-no-reasons detection when context.detection is absent", () => {
    const context = makeContext();
    const result = new AnalyzeChangesStage().execute(context);
    expect(result.changeMagnitude).toBe(ChangeMagnitude.MetadataOnly);
  });
});
