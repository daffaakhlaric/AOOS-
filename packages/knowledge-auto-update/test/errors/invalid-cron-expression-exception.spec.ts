import { describe, expect, it } from "vitest";

import { InvalidCronExpressionException } from "../../src/errors/invalid-cron-expression-exception.js";
import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";

describe("InvalidCronExpressionException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new InvalidCronExpressionException("* *", "bad")).toBeInstanceOf(
      KnowledgeAutoUpdateException,
    );
  });

  it("sets code INVALID_CRON_EXPRESSION", () => {
    expect(new InvalidCronExpressionException("* *", "bad").code).toBe("INVALID_CRON_EXPRESSION");
  });

  it("includes expression and reason in message and context", () => {
    const error = new InvalidCronExpressionException("bad expr", "expected 5 fields");
    expect(error.message).toContain("bad expr");
    expect(error.message).toContain("expected 5 fields");
    expect(error.context).toEqual({ expression: "bad expr", reason: "expected 5 fields" });
  });
});
