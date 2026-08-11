import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { RateLimitError } from "../../../../src/domain/errors/RateLimitError.js";
import { WhatsAppApiError } from "../../../../src/domain/errors/WhatsAppApiError.js";

describe("RateLimitError", () => {
  it("carries the given retryAfterMs", () => {
    const error = new RateLimitError("rate limited", 2500);
    expect(error.retryAfterMs).toBe(2500);
  });

  it("forces httpStatus to 429 even if an options.httpStatus is (mistakenly) passed", () => {
    const error = new RateLimitError("rate limited", 1000, {
      // @ts-expect-error -- AosErrorOptions has no httpStatus; RateLimitError always overrides it.
      httpStatus: 999,
    });
    expect(error.httpStatus).toBe(429);
  });

  it("maps to ErrorCode.RATE_LIMITED, not the WhatsAppApiError default", () => {
    const error = new RateLimitError("rate limited", 1000);
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
  });

  it("is a WhatsAppApiError and propagates cause/context", () => {
    const cause = new Error("429 from Meta");
    const error = new RateLimitError("rate limited", 1000, {
      cause,
      context: { correlationId: "corr-9" },
    });
    expect(error).toBeInstanceOf(WhatsAppApiError);
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ correlationId: "corr-9" });
    expect(error.name).toBe("RateLimitError");
  });
});
