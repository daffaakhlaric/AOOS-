import { describe, expect, it } from "vitest";

import { knowledgeRetrievalStateSchema } from "../../src/domain/knowledge-retrieval-state-schema.js";
import { KnowledgeRetrievalState } from "../../src/domain/knowledge-retrieval-state.js";

describe("knowledgeRetrievalStateSchema", () => {
  it("accepts every KnowledgeRetrievalState value", () => {
    for (const state of Object.values(KnowledgeRetrievalState)) {
      expect(knowledgeRetrievalStateSchema.parse(state)).toBe(state);
    }
  });

  it("rejects an unknown state string", () => {
    expect(() => knowledgeRetrievalStateSchema.parse("bogus")).toThrow();
  });
});
