import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { WhatsAppConnectorError } from "../../../../src/domain/errors/WhatsAppConnectorError.js";

describe("WhatsAppConnectorError", () => {
  it("sets name to the concrete subclass name via new.target (AosError convention)", () => {
    class SubError extends WhatsAppConnectorError {}
    const error = new SubError(ErrorCode.INTERNAL, "boom");
    expect(error.name).toBe("SubError");
  });

  it("sets name to its own class name when constructed directly", () => {
    const error = new WhatsAppConnectorError(ErrorCode.INTERNAL, "boom");
    expect(error.name).toBe("WhatsAppConnectorError");
  });

  it("propagates options.cause onto the underlying Error", () => {
    const cause = new Error("root cause");
    const error = new WhatsAppConnectorError(ErrorCode.INTERNAL, "boom", { cause });
    expect(error.cause).toBe(cause);
  });

  it("propagates options.context and exposes it via toJSON", () => {
    const error = new WhatsAppConnectorError(ErrorCode.INTERNAL, "boom", {
      context: { tenantId: "dss-motor", correlationId: "corr-1" },
    });
    expect(error.context).toEqual({ tenantId: "dss-motor", correlationId: "corr-1" });
    expect(error.toJSON()).toEqual({
      name: "WhatsAppConnectorError",
      code: ErrorCode.INTERNAL,
      message: "boom",
      context: { tenantId: "dss-motor", correlationId: "corr-1" },
    });
  });

  it("is a real Error instance usable with instanceof/try-catch", () => {
    const error = new WhatsAppConnectorError(ErrorCode.INTERNAL, "boom");
    expect(error).toBeInstanceOf(Error);
    expect(error.stack).toBeDefined();
  });
});
