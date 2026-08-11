import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import {
  ApiServerError,
  WhatsAppApiError,
} from "../../../../src/domain/errors/WhatsAppApiError.js";
import { WhatsAppConnectorError } from "../../../../src/domain/errors/WhatsAppConnectorError.js";

describe("WhatsAppApiError", () => {
  it("defaults to ErrorCode.UNAVAILABLE when no code is passed", () => {
    const error = new WhatsAppApiError("failed");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("accepts an explicit code override via the constructor's third param", () => {
    const error = new WhatsAppApiError("failed", {}, ErrorCode.VALIDATION_ERROR);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("carries metaErrorCode and httpStatus when provided", () => {
    const error = new WhatsAppApiError("failed", { metaErrorCode: 4, httpStatus: 429 });
    expect(error.metaErrorCode).toBe(4);
    expect(error.httpStatus).toBe(429);
  });

  it("propagates cause and context like its base class", () => {
    const cause = new Error("network down");
    const error = new WhatsAppApiError("failed", {
      cause,
      context: { tenantId: "dss-motor" },
    });
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tenantId: "dss-motor" });
  });

  it("is an instance of WhatsAppConnectorError", () => {
    const error = new WhatsAppApiError("failed");
    expect(error).toBeInstanceOf(WhatsAppConnectorError);
    expect(error.name).toBe("WhatsAppApiError");
  });
});

describe("ApiServerError", () => {
  it("is fixed to ErrorCode.UNAVAILABLE regardless of what a caller might otherwise pass", () => {
    const error = new ApiServerError("server down");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error.name).toBe("ApiServerError");
  });

  it("is a WhatsAppApiError and carries an optional httpStatus", () => {
    const error = new ApiServerError("server down", { httpStatus: 503 });
    expect(error).toBeInstanceOf(WhatsAppApiError);
    expect(error.httpStatus).toBe(503);
  });

  it("leaves httpStatus undefined for a bare network failure with no HTTP response", () => {
    const error = new ApiServerError("ECONNRESET");
    expect(error.httpStatus).toBeUndefined();
  });
});
