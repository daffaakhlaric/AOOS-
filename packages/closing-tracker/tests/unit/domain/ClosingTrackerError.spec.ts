import { ErrorCode } from "@aos/common";
import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { ClosingTrackerError } from "../../../src/domain/errors/ClosingTrackerError.js";

describe("ClosingTrackerError", () => {
  it("is an AosError with a default VALIDATION_ERROR code", () => {
    const error = new ClosingTrackerError("boom");
    expect(error).toBeInstanceOf(AosError);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe("boom");
    expect(error.name).toBe("ClosingTrackerError");
  });

  it("accepts an explicit code override", () => {
    const error = new ClosingTrackerError("boom", { code: ErrorCode.INTERNAL });
    expect(error.code).toBe(ErrorCode.INTERNAL);
  });

  it("carries a cause and context", () => {
    const cause = new Error("root cause");
    const error = new ClosingTrackerError("boom", { cause, context: { tenantId: "dss-motor" } });
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tenantId: "dss-motor" });
  });

  it("serializes to a log-safe structured shape via toJSON", () => {
    const error = new ClosingTrackerError("boom", { context: { tenantId: "dss-motor" } });
    expect(error.toJSON()).toEqual({
      name: "ClosingTrackerError",
      code: ErrorCode.VALIDATION_ERROR,
      message: "boom",
      context: { tenantId: "dss-motor" },
    });
  });
});
