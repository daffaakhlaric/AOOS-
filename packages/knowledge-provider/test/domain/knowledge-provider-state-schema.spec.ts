import { describe, expect, it } from "vitest";

import { knowledgeProviderStateSchema } from "../../src/domain/knowledge-provider-state-schema.js";
import { KnowledgeProviderState } from "../../src/domain/knowledge-provider-state.js";

describe("knowledgeProviderStateSchema", () => {
  it("accepts every KnowledgeProviderState value", () => {
    for (const state of Object.values(KnowledgeProviderState)) {
      expect(knowledgeProviderStateSchema.parse(state)).toBe(state);
    }
  });

  it("rejects an unknown state string", () => {
    expect(() => knowledgeProviderStateSchema.parse("bogus")).toThrow();
  });
});
