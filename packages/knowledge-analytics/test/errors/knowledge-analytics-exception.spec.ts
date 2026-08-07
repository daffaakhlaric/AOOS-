import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsException } from "../../src/errors/knowledge-analytics-exception.js";

describe("KnowledgeAnalyticsException", () => {
  it("defaults code to KNOWLEDGE_ANALYTICS_ERROR", () => {
    const error = new KnowledgeAnalyticsException("boom");
    expect(error.code).toBe("KNOWLEDGE_ANALYTICS_ERROR");
  });

  it("stores the message", () => {
    const error = new KnowledgeAnalyticsException("boom");
    expect(error.message).toBe("boom");
  });

  it("uses the concrete subclass name (new.target.name)", () => {
    class SubException extends KnowledgeAnalyticsException {}
    const error = new SubException("boom");
    expect(error.name).toBe("SubException");
  });

  it("is an instance of Error", () => {
    expect(new KnowledgeAnalyticsException("boom")).toBeInstanceOf(Error);
  });

  it("accepts a custom code", () => {
    const error = new KnowledgeAnalyticsException("boom", { code: "CUSTOM" });
    expect(error.code).toBe("CUSTOM");
  });

  it("accepts and exposes a cause", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeAnalyticsException("boom", { cause });
    expect(error.cause).toBe(cause);
  });

  it("accepts and exposes context", () => {
    const error = new KnowledgeAnalyticsException("boom", { context: { key: "value" } });
    expect(error.context).toEqual({ key: "value" });
  });

  it("leaves context undefined when not supplied", () => {
    const error = new KnowledgeAnalyticsException("boom");
    expect(error.context).toBeUndefined();
  });

  it("leaves cause undefined when not supplied", () => {
    const error = new KnowledgeAnalyticsException("boom");
    expect(error.cause).toBeUndefined();
  });

  it("preserves prototype chain via Object.setPrototypeOf", () => {
    class SubException extends KnowledgeAnalyticsException {}
    const error = new SubException("boom");
    expect(error).toBeInstanceOf(SubException);
    expect(error).toBeInstanceOf(KnowledgeAnalyticsException);
  });
});
