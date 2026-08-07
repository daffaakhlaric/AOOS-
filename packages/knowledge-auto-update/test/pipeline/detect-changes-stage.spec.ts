import { beforeEach, describe, expect, it } from "vitest";

import { DetectChangesStage } from "../../src/pipeline/stages/detect-changes-stage.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";
import { makeContext } from "../helpers/pipeline-helpers.js";

describe("DetectChangesStage", () => {
  beforeEach(resetFixtureState);

  it("detects a version change from job payload vs previousPayload", () => {
    const job = makeJob({ payload: { version: "2.0.0" }, previousPayload: { version: "1.0.0" } });
    const context = new DetectChangesStage().execute(makeContext({ job }));
    expect(context.detection?.changed).toBe(true);
    expect(context.detection?.reasons).toContain("version_changed");
  });

  it("treats an absent previousPayload as an empty snapshot", () => {
    const job = makeJob({ payload: { version: "1.0.0" } });
    const context = new DetectChangesStage().execute(makeContext({ job }));
    expect(context.detection?.reasons).toContain("version_added");
  });

  it("detects no change for identical payloads", () => {
    const job = makeJob({ payload: { checksum: "abc" }, previousPayload: { checksum: "abc" } });
    const context = new DetectChangesStage().execute(makeContext({ job }));
    expect(context.detection?.changed).toBe(false);
  });
});
