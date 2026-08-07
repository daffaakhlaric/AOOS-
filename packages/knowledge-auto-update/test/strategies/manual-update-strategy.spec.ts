import { describe, expect, it } from "vitest";

import { ManualUpdateStrategy } from "../../src/strategies/manual-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("ManualUpdateStrategy", () => {
  it("declares updateType Manual", () => {
    expect(new ManualUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Manual);
  });

  it("full-replaces with the task payload", () => {
    const task = makeTask({ payload: { a: 1 }, previousPayload: { a: 0 } });
    const result = new ManualUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
    expect(result.appliedPayload).toEqual({ a: 1 });
  });

  it("reports durationMs 0 and completedAt matching now", () => {
    const task = makeTask();
    const result = new ManualUpdateStrategy().execute({ task, now: 777 });
    expect(result.durationMs).toBe(0);
    expect(result.completedAt).toBe(777);
  });
});
