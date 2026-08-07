import { describe, expect, it } from "vitest";

import { MetadataUpdateStrategy } from "../../src/strategies/metadata-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("MetadataUpdateStrategy", () => {
  it("declares updateType Metadata", () => {
    expect(new MetadataUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Metadata);
  });

  it("merges payload on top of previousPayload", () => {
    const task = makeTask({ payload: { tag: "new" }, previousPayload: { tag: "old", other: 1 } });
    const result = new MetadataUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ tag: "new", other: 1 });
  });

  it("succeeds even when both payload and previousPayload are empty", () => {
    const task = makeTask({ payload: {}, previousPayload: {} });
    const result = new MetadataUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
    expect(result.appliedPayload).toEqual({});
  });
});
