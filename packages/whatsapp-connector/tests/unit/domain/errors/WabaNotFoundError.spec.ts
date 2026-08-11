import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { WabaNotFoundError } from "../../../../src/domain/errors/WabaNotFoundError.js";
import { WhatsAppConnectorError } from "../../../../src/domain/errors/WhatsAppConnectorError.js";

describe("WabaNotFoundError", () => {
  it("maps to ErrorCode.NOT_FOUND", () => {
    const error = new WabaNotFoundError("no waba registered for phoneNumberId 123");
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("is a direct WhatsAppConnectorError, not a WhatsAppApiError (it's a registry lookup failure, not an API failure)", () => {
    const error = new WabaNotFoundError("no waba for branch MULTI");
    expect(error).toBeInstanceOf(WhatsAppConnectorError);
    expect(error.name).toBe("WabaNotFoundError");
  });

  it("carries the unresolved lookup key in its message for observability", () => {
    const error = new WabaNotFoundError("no WabaAccount registered for branch: MULTI");
    expect(error.message).toContain("MULTI");
  });

  it("propagates context", () => {
    const error = new WabaNotFoundError("not found", { context: { tenantId: "dss-motor" } });
    expect(error.context).toEqual({ tenantId: "dss-motor" });
  });
});
