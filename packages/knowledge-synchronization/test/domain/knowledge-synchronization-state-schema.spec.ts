import { describe, expect, it } from "vitest";

import { knowledgeSynchronizationStateSchema } from "../../src/domain/knowledge-synchronization-state-schema.js";
import { KnowledgeSynchronizationState } from "../../src/domain/knowledge-synchronization-state.js";

describe("knowledgeSynchronizationStateSchema", () => {
  it("accepts every KnowledgeSynchronizationState value", () => {
    for (const state of Object.values(KnowledgeSynchronizationState)) {
      expect(knowledgeSynchronizationStateSchema.parse(state)).toBe(state);
    }
  });

  it("rejects an unknown state string", () => {
    expect(() => knowledgeSynchronizationStateSchema.parse("bogus")).toThrow();
  });
});
