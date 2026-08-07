import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { ValidationFailedException } from "../../src/errors/validation-failed-exception.js";

describe("ValidationFailedException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new ValidationFailedException("job x", ["bad"])).toBeInstanceOf(
      KnowledgeAutoUpdateException,
    );
  });

  it("sets code VALIDATION_FAILED", () => {
    expect(new ValidationFailedException("job x", ["bad"]).code).toBe("VALIDATION_FAILED");
  });

  it("joins subject and reasons into the message", () => {
    const error = new ValidationFailedException("job x", ["reason one", "reason two"]);
    expect(error.message).toContain("job x");
    expect(error.message).toContain("reason one; reason two");
    expect(error.context).toEqual({ subject: "job x", reasons: ["reason one", "reason two"] });
  });
});
