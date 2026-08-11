import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import {
  PayloadParseError,
  SignatureVerificationError,
  TokenVerificationError,
  WebhookError,
} from "../../../../src/domain/errors/WebhookVerificationError.js";
import { WhatsAppConnectorError } from "../../../../src/domain/errors/WhatsAppConnectorError.js";

describe("WebhookError and its subclasses", () => {
  it.each([
    ["WebhookError", () => new WebhookError("bad webhook")],
    ["SignatureVerificationError", () => new SignatureVerificationError("bad sig")],
    ["TokenVerificationError", () => new TokenVerificationError("bad token")],
    ["PayloadParseError", () => new PayloadParseError("bad payload")],
  ] as const)("%s sets its own class name and maps to VALIDATION_ERROR", (expectedName, make) => {
    const error = make();
    expect(error.name).toBe(expectedName);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("every subclass is both a WebhookError and a WhatsAppConnectorError", () => {
    for (const error of [
      new SignatureVerificationError("x"),
      new TokenVerificationError("x"),
      new PayloadParseError("x"),
    ]) {
      expect(error).toBeInstanceOf(WebhookError);
      expect(error).toBeInstanceOf(WhatsAppConnectorError);
    }
  });

  it("SignatureVerificationError is not a TokenVerificationError or PayloadParseError (siblings, not each other)", () => {
    const error = new SignatureVerificationError("x");
    expect(error).not.toBeInstanceOf(TokenVerificationError);
    expect(error).not.toBeInstanceOf(PayloadParseError);
  });

  it("PayloadParseError propagates a context.issues array (used by WebhookParser)", () => {
    const error = new PayloadParseError("schema validation failed", {
      context: { issues: ["(root): Expected object, received string"] },
    });
    expect(error.context?.issues).toEqual(["(root): Expected object, received string"]);
  });

  it("propagates cause through the WebhookError base constructor", () => {
    const cause = new Error("zod issue");
    const error = new PayloadParseError("bad payload", { cause });
    expect(error.cause).toBe(cause);
  });
});
