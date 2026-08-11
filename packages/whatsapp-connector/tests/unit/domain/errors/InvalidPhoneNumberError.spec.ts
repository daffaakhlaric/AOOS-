import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { InvalidPhoneNumberError } from "../../../../src/domain/errors/InvalidPhoneNumberError.js";
import { WhatsAppConnectorError } from "../../../../src/domain/errors/WhatsAppConnectorError.js";

describe("InvalidPhoneNumberError", () => {
  it("maps to ErrorCode.VALIDATION_ERROR", () => {
    const error = new InvalidPhoneNumberError("cannot normalize to E.164");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("is a direct WhatsAppConnectorError", () => {
    const error = new InvalidPhoneNumberError("not an Indonesian number");
    expect(error).toBeInstanceOf(WhatsAppConnectorError);
    expect(error.name).toBe("InvalidPhoneNumberError");
  });

  it("propagates cause and context", () => {
    const cause = new Error("regex mismatch");
    const error = new InvalidPhoneNumberError("bad phone", {
      cause,
      context: { correlationId: "corr-1" },
    });
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ correlationId: "corr-1" });
  });
});
