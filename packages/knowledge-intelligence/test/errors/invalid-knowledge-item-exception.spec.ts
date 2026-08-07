import { describe, expect, it } from "vitest";

import { InvalidKnowledgeItemException } from "../../src/errors/invalid-knowledge-item-exception.js";
import { KnowledgeIntelligenceException } from "../../src/errors/knowledge-intelligence-exception.js";

describe("InvalidKnowledgeItemException", () => {
  it("carries the item id, reason, and a stable code", () => {
    const error = new InvalidKnowledgeItemException("item-1", "id must not be empty");
    expect(error.code).toBe("INVALID_KNOWLEDGE_ITEM");
    expect(error.context).toEqual({ itemId: "item-1", reason: "id must not be empty" });
  });

  it("is a KnowledgeIntelligenceException", () => {
    expect(new InvalidKnowledgeItemException("x", "y")).toBeInstanceOf(
      KnowledgeIntelligenceException,
    );
  });
});
