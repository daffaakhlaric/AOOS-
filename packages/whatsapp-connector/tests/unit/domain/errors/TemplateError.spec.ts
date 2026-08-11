import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { TemplateError } from "../../../../src/domain/errors/TemplateError.js";
import { WhatsAppApiError } from "../../../../src/domain/errors/WhatsAppApiError.js";

describe("TemplateError", () => {
  it("maps to ErrorCode.VALIDATION_ERROR, unlike the WhatsAppApiError default", () => {
    const error = new TemplateError("template not approved");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("does not force any particular httpStatus/metaErrorCode (caller-supplied, unlike AuthError/RateLimitError)", () => {
    const error = new TemplateError("wrong param count", {
      context: { httpStatusHint: 400 },
    });
    expect(error.httpStatus).toBeUndefined();
    expect(error.metaErrorCode).toBeUndefined();
  });

  it("is a WhatsAppApiError and propagates cause", () => {
    const cause = new Error("Meta code 132000");
    const error = new TemplateError("template not approved", { cause });
    expect(error).toBeInstanceOf(WhatsAppApiError);
    expect(error.cause).toBe(cause);
    expect(error.name).toBe("TemplateError");
  });
});
