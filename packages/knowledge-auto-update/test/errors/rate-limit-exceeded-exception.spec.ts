import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { RateLimitExceededException } from "../../src/errors/rate-limit-exceeded-exception.js";

describe("RateLimitExceededException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new RateLimitExceededException("scope-1", 10, 60_000)).toBeInstanceOf(
      KnowledgeAutoUpdateException,
    );
  });

  it("sets code RATE_LIMIT_EXCEEDED", () => {
    expect(new RateLimitExceededException("scope-1", 10, 60_000).code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("includes scopeId, limit, and windowMs", () => {
    const error = new RateLimitExceededException("scope-2", 5, 30_000);
    expect(error.message).toContain("scope-2");
    expect(error.message).toContain("5");
    expect(error.message).toContain("30000");
    expect(error.context).toEqual({ scopeId: "scope-2", limit: 5, windowMs: 30_000 });
  });
});
