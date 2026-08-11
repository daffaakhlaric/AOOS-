import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import {
  ApiServerError,
  AuthError,
  ConnectorConfigError,
  MetaAdsConnectorError,
  MetaApiError,
  PayloadParseError,
  PermissionError,
  RateLimitError,
  SignatureVerificationError,
  TokenVerificationError,
  WebhookError,
} from "../../../../src/domain/errors/index.js";

describe("MetaAdsConnectorError", () => {
  it("carries the given code and message", () => {
    const error = new MetaAdsConnectorError(ErrorCode.VALIDATION_ERROR, "boom");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe("boom");
  });
});

describe("MetaApiError", () => {
  it("defaults to ErrorCode.UNAVAILABLE", () => {
    expect(new MetaApiError("fail").code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("carries optional metaErrorCode/httpStatus", () => {
    const error = new MetaApiError("fail", { metaErrorCode: 190, httpStatus: 401 });
    expect(error.metaErrorCode).toBe(190);
    expect(error.httpStatus).toBe(401);
  });

  it("is an instance of MetaAdsConnectorError", () => {
    expect(new MetaApiError("fail")).toBeInstanceOf(MetaAdsConnectorError);
  });
});

describe("ApiServerError", () => {
  it("extends MetaApiError with ErrorCode.UNAVAILABLE", () => {
    const error = new ApiServerError("server down");
    expect(error).toBeInstanceOf(MetaApiError);
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });
});

describe("RateLimitError", () => {
  it("always carries httpStatus 429 and ErrorCode.RATE_LIMITED", () => {
    const error = new RateLimitError("rate limited", 5000);
    expect(error.httpStatus).toBe(429);
    expect(error.retryAfterMs).toBe(5000);
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
  });

  it("is a MetaApiError", () => {
    expect(new RateLimitError("x", 0)).toBeInstanceOf(MetaApiError);
  });
});

describe("AuthError", () => {
  it("carries Meta code 190, httpStatus 401, and ErrorCode.UNAUTHORIZED", () => {
    const error = new AuthError("token invalid");
    expect(error.metaErrorCode).toBe(190);
    expect(error.httpStatus).toBe(401);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
  });
});

describe("PermissionError", () => {
  it("carries Meta code 200, httpStatus 403, and ErrorCode.FORBIDDEN", () => {
    const error = new PermissionError("missing permission");
    expect(error.metaErrorCode).toBe(200);
    expect(error.httpStatus).toBe(403);
    expect(error.code).toBe(ErrorCode.FORBIDDEN);
  });
});

describe("WebhookError and subclasses", () => {
  it("WebhookError uses ErrorCode.VALIDATION_ERROR", () => {
    expect(new WebhookError("bad webhook").code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("SignatureVerificationError is a WebhookError", () => {
    expect(new SignatureVerificationError("bad sig")).toBeInstanceOf(WebhookError);
  });

  it("TokenVerificationError is a WebhookError", () => {
    expect(new TokenVerificationError("bad token")).toBeInstanceOf(WebhookError);
  });

  it("PayloadParseError is a WebhookError", () => {
    expect(new PayloadParseError("bad payload")).toBeInstanceOf(WebhookError);
  });
});

describe("ConnectorConfigError", () => {
  it("uses ErrorCode.VALIDATION_ERROR and is a MetaAdsConnectorError", () => {
    const error = new ConnectorConfigError("bad config");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error).toBeInstanceOf(MetaAdsConnectorError);
  });
});
