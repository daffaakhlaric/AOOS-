import { describe, expect, it } from "vitest";

import { DependencyUpdateStrategy } from "../../src/strategies/dependency-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("DependencyUpdateStrategy", () => {
  it("declares updateType Dependency", () => {
    expect(new DependencyUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Dependency);
  });

  it("tags the applied payload with dependencyUpdated", () => {
    const task = makeTask({ payload: { a: 1 } });
    const result = new DependencyUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 1, dependencyUpdated: true });
  });

  it("reports success = true for an empty payload", () => {
    const task = makeTask({ payload: {} });
    const result = new DependencyUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
  });
});
