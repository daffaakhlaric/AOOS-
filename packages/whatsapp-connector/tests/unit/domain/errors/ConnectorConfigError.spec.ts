import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { ConnectorConfigError } from "../../../../src/domain/errors/ConnectorConfigError.js";
import { WhatsAppConnectorError } from "../../../../src/domain/errors/WhatsAppConnectorError.js";

describe("ConnectorConfigError", () => {
  it("maps to ErrorCode.VALIDATION_ERROR", () => {
    const error = new ConnectorConfigError("accessToken must be non-empty");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("is a direct WhatsAppConnectorError", () => {
    const error = new ConnectorConfigError("wabaAccounts must not be empty");
    expect(error).toBeInstanceOf(WhatsAppConnectorError);
    expect(error.name).toBe("ConnectorConfigError");
  });

  it("propagates cause (e.g. the underlying ZodError)", () => {
    const cause = new Error("zod: invalid_literal");
    const error = new ConnectorConfigError("bad apiVersion", { cause });
    expect(error.cause).toBe(cause);
  });
});
