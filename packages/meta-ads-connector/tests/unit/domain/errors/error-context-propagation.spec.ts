import { describe, expect, it } from "vitest";

import {
  ApiServerError,
  PayloadParseError,
  RateLimitError,
  SignatureVerificationError,
} from "../../../../src/domain/errors/index.js";

describe("Error context/cause propagation (AosErrorOptions)", () => {
  it("ApiServerError carries a `cause` through to the base error", () => {
    const cause = new Error("underlying network failure");
    const error = new ApiServerError("wrapped", { cause });
    expect(error.cause).toBe(cause);
  });

  it("ApiServerError carries a `context` object through to the base error", () => {
    const error = new ApiServerError("wrapped", { context: { httpStatus: 503 } });
    expect(error.context).toEqual({ httpStatus: 503 });
  });

  it("PayloadParseError carries a `context` with the Zod issue list", () => {
    const error = new PayloadParseError("bad shape", {
      context: { issues: ["entry.0: Required"] },
    });
    expect(error.context).toEqual({ issues: ["entry.0: Required"] });
  });

  it("SignatureVerificationError needs no options and still has a stable message", () => {
    const error = new SignatureVerificationError("bad signature");
    expect(error.message).toBe("bad signature");
  });

  it("RateLimitError's retryAfterMs is independent of any options.context", () => {
    const error = new RateLimitError("rate limited", 12_345, { context: { extra: true } });
    expect(error.retryAfterMs).toBe(12_345);
    expect(error.context).toEqual({ extra: true });
  });
});
