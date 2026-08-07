import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";

describe("KnowledgeAutoUpdateException", () => {
  it("defaults code to KNOWLEDGE_AUTO_UPDATE_ERROR", () => {
    const error = new KnowledgeAutoUpdateException("boom");
    expect(error.code).toBe("KNOWLEDGE_AUTO_UPDATE_ERROR");
    expect(error.message).toBe("boom");
  });

  it("sets name to the concrete subclass name", () => {
    class MyException extends KnowledgeAutoUpdateException {}
    const error = new MyException("oops");
    expect(error.name).toBe("MyException");
  });

  it("accepts a custom code, cause, and context", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeAutoUpdateException("failure", {
      code: "CUSTOM",
      cause,
      context: { key: "value" },
    });
    expect(error.code).toBe("CUSTOM");
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ key: "value" });
  });

  it("is an instance of Error", () => {
    expect(new KnowledgeAutoUpdateException("x")).toBeInstanceOf(Error);
  });

  it("leaves context undefined when not supplied", () => {
    expect(new KnowledgeAutoUpdateException("x").context).toBeUndefined();
  });
});
