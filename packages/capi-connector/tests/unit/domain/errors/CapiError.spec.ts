import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CapiError } from "../../../../src/domain/errors/CapiError.js";

describe("CapiError", () => {
  it("defaults to ErrorCode.VALIDATION_ERROR", () => {
    const error = new CapiError("boom");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe("boom");
    expect(error.name).toBe("CapiError");
  });

  it("accepts an explicit code override", () => {
    const error = new CapiError("boom", { code: ErrorCode.NOT_FOUND });
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("carries cause/context through to AosError", () => {
    const cause = new Error("root cause");
    const error = new CapiError("boom", { cause, context: { tenantId: "t1" } });
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tenantId: "t1" });
  });

  it("is an instance of Error", () => {
    expect(new CapiError("boom")).toBeInstanceOf(Error);
  });
});
