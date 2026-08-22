import { ErrorCode } from "@aos/common";
import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import {
  ApiServerError,
  AuthError,
  MetaGraphApiError,
  MetaOrganicConnectorError,
  PermissionError,
  RateLimitError,
} from "../../../../src/domain/errors/index.js";

describe("MetaOrganicConnectorError", () => {
  it("extends AosError", () => {
    const error = new MetaOrganicConnectorError(ErrorCode.INTERNAL, "boom");
    expect(error).toBeInstanceOf(AosError);
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.message).toBe("boom");
  });
});

describe("MetaGraphApiError", () => {
  it("defaults to ErrorCode.UNAVAILABLE and carries metaErrorCode/httpStatus", () => {
    const error = new MetaGraphApiError("boom", { metaErrorCode: 1, httpStatus: 400 });
    expect(error).toBeInstanceOf(MetaOrganicConnectorError);
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error.metaErrorCode).toBe(1);
    expect(error.httpStatus).toBe(400);
  });

  it("defaults metaErrorCode/httpStatus to undefined when not given", () => {
    const error = new MetaGraphApiError("boom");
    expect(error.metaErrorCode).toBeUndefined();
    expect(error.httpStatus).toBeUndefined();
  });
});

describe("ApiServerError", () => {
  it("is a MetaGraphApiError with code UNAVAILABLE", () => {
    const error = new ApiServerError("server down");
    expect(error).toBeInstanceOf(MetaGraphApiError);
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });
});

describe("AuthError", () => {
  it("carries Meta's real invalid-token code 190 and httpStatus 401", () => {
    const error = new AuthError("token expired");
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(error.metaErrorCode).toBe(190);
    expect(error.httpStatus).toBe(401);
  });
});

describe("PermissionError", () => {
  it("carries Meta's real missing-permission code 200 and httpStatus 403", () => {
    const error = new PermissionError("missing pages_manage_posts");
    expect(error.code).toBe(ErrorCode.FORBIDDEN);
    expect(error.metaErrorCode).toBe(200);
    expect(error.httpStatus).toBe(403);
  });
});

describe("RateLimitError", () => {
  it("carries retryAfterMs and httpStatus 429", () => {
    const error = new RateLimitError("rate limited", 30_000);
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.httpStatus).toBe(429);
    expect(error.retryAfterMs).toBe(30_000);
  });
});
