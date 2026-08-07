import { describe, expect, it } from "vitest";

import { RefreshUpdateStrategy } from "../../src/strategies/refresh-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("RefreshUpdateStrategy", () => {
  it("declares updateType Refresh", () => {
    expect(new RefreshUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Refresh);
  });

  it("stamps refreshedAt with the given now", () => {
    const task = makeTask({ payload: { a: 1 } });
    const result = new RefreshUpdateStrategy().execute({ task, now: 555 });
    expect(result.appliedPayload).toEqual({ a: 1, refreshedAt: 555 });
  });

  it("overrides a pre-existing refreshedAt field", () => {
    const task = makeTask({ payload: { refreshedAt: 1 } });
    const result = new RefreshUpdateStrategy().execute({ task, now: 999 });
    expect(result.appliedPayload).toEqual({ refreshedAt: 999 });
  });
});
