import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import {
  ApiServerError,
  AuthError,
  ConnectorConfigError,
  InvalidMessageBodyError,
  InvalidPhoneNumberError,
  PayloadParseError,
  RateLimitError,
  SignatureVerificationError,
  TemplateError,
  TokenVerificationError,
  WabaNotFoundError,
  WebhookError,
  WhatsAppApiError,
  WhatsAppConnectorError,
} from "../../../src/domain/errors/index.js";

describe("WhatsAppConnectorError hierarchy", () => {
  it("WhatsAppConnectorError carries the given ErrorCode and message", () => {
    const error = new WhatsAppConnectorError(ErrorCode.INTERNAL, "boom");
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.message).toBe("boom");
    expect(error).toBeInstanceOf(Error);
  });

  it("WhatsAppApiError defaults to UNAVAILABLE and carries metaErrorCode/httpStatus", () => {
    const error = new WhatsAppApiError("api failed", { metaErrorCode: 1, httpStatus: 500 });
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error.metaErrorCode).toBe(1);
    expect(error.httpStatus).toBe(500);
    expect(error).toBeInstanceOf(WhatsAppConnectorError);
  });

  it("WhatsAppApiError defaults metaErrorCode/httpStatus to undefined when omitted", () => {
    const error = new WhatsAppApiError("api failed");
    expect(error.metaErrorCode).toBeUndefined();
    expect(error.httpStatus).toBeUndefined();
  });

  it("ApiServerError is a WhatsAppApiError with code UNAVAILABLE", () => {
    const error = new ApiServerError("server down");
    expect(error).toBeInstanceOf(WhatsAppApiError);
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("RateLimitError carries retryAfterMs and httpStatus 429", () => {
    const error = new RateLimitError("rate limited", 5000);
    expect(error.retryAfterMs).toBe(5000);
    expect(error.httpStatus).toBe(429);
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error).toBeInstanceOf(WhatsAppApiError);
  });

  it("AuthError carries Meta code 190 and httpStatus 401", () => {
    const error = new AuthError("bad token");
    expect(error.metaErrorCode).toBe(190);
    expect(error.httpStatus).toBe(401);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it("TemplateError maps to VALIDATION_ERROR", () => {
    const error = new TemplateError("template not approved");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error).toBeInstanceOf(WhatsAppApiError);
  });

  it("WebhookError and its subclasses map to VALIDATION_ERROR", () => {
    const base = new WebhookError("bad webhook");
    const sig = new SignatureVerificationError("bad sig");
    const token = new TokenVerificationError("bad token");
    const parse = new PayloadParseError("bad payload");

    for (const error of [base, sig, token, parse]) {
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error).toBeInstanceOf(WebhookError);
      expect(error).toBeInstanceOf(WhatsAppConnectorError);
    }
  });

  it("WabaNotFoundError maps to NOT_FOUND", () => {
    const error = new WabaNotFoundError("no waba");
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("InvalidPhoneNumberError maps to VALIDATION_ERROR", () => {
    const error = new InvalidPhoneNumberError("bad phone");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("InvalidMessageBodyError maps to VALIDATION_ERROR (spec gap fill — see engineering report resolution #3)", () => {
    const error = new InvalidMessageBodyError("body too long");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error).toBeInstanceOf(WhatsAppConnectorError);
  });

  it("ConnectorConfigError maps to VALIDATION_ERROR", () => {
    const error = new ConnectorConfigError("bad config");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
