import { describe, expect, it } from "vitest";

import { knowledgeSourceStateSchema } from "../../src/domain/knowledge-source-state-schema.js";
import { KnowledgeSourceState } from "../../src/domain/knowledge-source-state.js";

describe("knowledgeSourceStateSchema", () => {
  it("accepts every named state", () => {
    for (const state of Object.values(KnowledgeSourceState)) {
      expect(() => knowledgeSourceStateSchema.parse(state)).not.toThrow();
    }
  });

  it("rejects an unknown state", () => {
    expect(() => knowledgeSourceStateSchema.parse("not-a-state")).toThrow();
  });
});
