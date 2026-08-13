import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CreativeConnectorError } from "../../../../src/domain/errors/CreativeConnectorError.js";
import { RateLimitError } from "../../../../src/domain/errors/RateLimitError.js";

describe("RateLimitError", () => {
  it("uses ErrorCode.RATE_LIMITED", () => {
    const error = new RateLimitError("rate limited", 10_000);
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
  });

  it("is a CreativeConnectorError", () => {
    expect(new RateLimitError("x", 0)).toBeInstanceOf(CreativeConnectorError);
  });

  it("carries retryAfterMs", () => {
    const error = new RateLimitError("rate limited", 10_000);
    expect(error.retryAfterMs).toBe(10_000);
  });
});
