import { describe, expect, it } from "vitest";

import { FullUpdateStrategy } from "../../src/strategies/full-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("FullUpdateStrategy", () => {
  it("declares updateType Full", () => {
    expect(new FullUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Full);
  });

  it("full-replaces with the task payload, ignoring previousPayload", () => {
    const task = makeTask({ payload: { a: 3 }, previousPayload: { a: 0, b: 1 } });
    const result = new FullUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 3 });
  });

  it("works with an empty payload", () => {
    const task = makeTask({ payload: {} });
    const result = new FullUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
    expect(result.appliedPayload).toEqual({});
  });
});
