import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { AuthError } from "../../../../src/domain/errors/AuthError.js";
import { WhatsAppApiError } from "../../../../src/domain/errors/WhatsAppApiError.js";

describe("AuthError", () => {
  it("always carries Meta error code 190, regardless of the failure message", () => {
    const error = new AuthError("Invalid OAuth access token");
    expect(error.metaErrorCode).toBe(190);
  });

  it("always carries httpStatus 401", () => {
    const error = new AuthError("bad token");
    expect(error.httpStatus).toBe(401);
  });

  it("maps to ErrorCode.UNAUTHORIZED", () => {
    const error = new AuthError("bad token");
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it("is a WhatsAppApiError and propagates cause/context", () => {
    const cause = new Error("401 from Meta");
    const error = new AuthError("bad token", { cause, context: { tenantId: "dss-motor" } });
    expect(error).toBeInstanceOf(WhatsAppApiError);
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tenantId: "dss-motor" });
    expect(error.name).toBe("AuthError");
  });
});
