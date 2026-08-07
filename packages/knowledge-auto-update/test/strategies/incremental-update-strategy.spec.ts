import { describe, expect, it } from "vitest";

import { IncrementalUpdateStrategy } from "../../src/strategies/incremental-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("IncrementalUpdateStrategy", () => {
  it("declares updateType Incremental", () => {
    expect(new IncrementalUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Incremental);
  });

  it("merges payload on top of previousPayload", () => {
    const task = makeTask({ payload: { b: 2 }, previousPayload: { a: 1, b: 1 } });
    const result = new IncrementalUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 1, b: 2 });
  });

  it("works with no previousPayload (treated as empty)", () => {
    const task = makeTask({ payload: { a: 1 } });
    const result = new IncrementalUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 1 });
  });

  it("overwrites overlapping keys and keeps non-overlapping keys from both sides", () => {
    const task = makeTask({ payload: { b: 20, c: 30 }, previousPayload: { a: 10, b: 1 } });
    const result = new IncrementalUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 10, b: 20, c: 30 });
  });
});
