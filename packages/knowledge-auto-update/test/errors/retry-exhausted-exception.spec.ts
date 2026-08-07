import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { RetryExhaustedException } from "../../src/errors/retry-exhausted-exception.js";

describe("RetryExhaustedException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new RetryExhaustedException("job-1", 3, 3)).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code RETRY_EXHAUSTED", () => {
    expect(new RetryExhaustedException("job-1", 3, 3).code).toBe("RETRY_EXHAUSTED");
  });

  it("includes attempts and maxRetries in message and context", () => {
    const error = new RetryExhaustedException("job-5", 4, 3);
    expect(error.message).toContain("4 attempts");
    expect(error.message).toContain("max 3");
    expect(error.context).toEqual({ jobId: "job-5", attempts: 4, maxRetries: 3 });
  });
});
