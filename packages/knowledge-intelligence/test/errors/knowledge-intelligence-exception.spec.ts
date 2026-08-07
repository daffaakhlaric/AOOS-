import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceException } from "../../src/errors/knowledge-intelligence-exception.js";

describe("KnowledgeIntelligenceException", () => {
  it("defaults the code to KNOWLEDGE_INTELLIGENCE_ERROR", () => {
    const error = new KnowledgeIntelligenceException("boom");
    expect(error.code).toBe("KNOWLEDGE_INTELLIGENCE_ERROR");
    expect(error.message).toBe("boom");
  });

  it("uses the concrete subclass name for `name`", () => {
    class SubException extends KnowledgeIntelligenceException {}
    const error = new SubException("sub-boom");
    expect(error.name).toBe("SubException");
  });

  it("accepts a custom code, cause, and context", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeIntelligenceException("boom", {
      code: "CUSTOM",
      cause,
      context: { a: 1 },
    });
    expect(error.code).toBe("CUSTOM");
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ a: 1 });
  });

  it("is an instance of Error", () => {
    expect(new KnowledgeIntelligenceException("x")).toBeInstanceOf(Error);
  });
});
