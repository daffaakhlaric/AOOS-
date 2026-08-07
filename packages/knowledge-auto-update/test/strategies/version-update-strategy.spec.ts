import { describe, expect, it } from "vitest";

import { VersionUpdateStrategy } from "../../src/strategies/version-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("VersionUpdateStrategy", () => {
  it("declares updateType Version", () => {
    expect(new VersionUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Version);
  });

  it("succeeds when the new version is newer than the previous one", () => {
    const task = makeTask({ payload: { version: "2.0.0" }, previousPayload: { version: "1.0.0" } });
    const result = new VersionUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
    expect(result.appliedPayload).toEqual({ version: "2.0.0" });
  });

  it("succeeds when there is no previous version to compare against", () => {
    const task = makeTask({ payload: { version: "1.0.0" } });
    const result = new VersionUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
  });

  it("fails when payload.version is missing", () => {
    const task = makeTask({ payload: {} });
    const result = new VersionUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("valid payload.version");
  });

  it("fails when payload.version is not a valid version string", () => {
    const task = makeTask({ payload: { version: "not-a-version" } });
    const result = new VersionUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(false);
  });

  it("fails when the new version is not newer than the previous version", () => {
    const task = makeTask({ payload: { version: "1.0.0" }, previousPayload: { version: "2.0.0" } });
    const result = new VersionUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("newer than previous");
  });

  it("fails when the new version equals the previous version", () => {
    const task = makeTask({ payload: { version: "1.0.0" }, previousPayload: { version: "1.0.0" } });
    const result = new VersionUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(false);
  });
});
