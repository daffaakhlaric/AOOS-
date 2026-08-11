import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { InvalidMessageBodyError } from "../../../../src/domain/errors/InvalidMessageBodyError.js";
import { WhatsAppConnectorError } from "../../../../src/domain/errors/WhatsAppConnectorError.js";
import { MessageBody } from "../../../../src/domain/value-objects/MessageBody.js";
import { unwrapErr } from "../../../helpers/result.js";

describe("InvalidMessageBodyError", () => {
  it("maps to ErrorCode.VALIDATION_ERROR", () => {
    const error = new InvalidMessageBodyError("body too long");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("is a direct WhatsAppConnectorError, added per the engineering report's resolution #3 gap fill", () => {
    const error = new InvalidMessageBodyError("body too long");
    expect(error).toBeInstanceOf(WhatsAppConnectorError);
    expect(error.name).toBe("InvalidMessageBodyError");
  });

  it("is the actual concrete error class MessageBody.create returns in production, not just a hand-constructed double", () => {
    const error = unwrapErr(MessageBody.create("a".repeat(4097)));
    expect(error).toBeInstanceOf(InvalidMessageBodyError);
    expect(error.name).toBe("InvalidMessageBodyError");
  });

  it("propagates context", () => {
    const error = new InvalidMessageBodyError("empty body", { context: { tenantId: "dss-motor" } });
    expect(error.context).toEqual({ tenantId: "dss-motor" });
  });
});
