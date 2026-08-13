import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CapiApiError } from "../../../../src/domain/errors/CapiApiError.js";

describe("CapiApiError", () => {
  it("defaults to ErrorCode.UNAVAILABLE", () => {
    const error = new CapiApiError("boom");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("carries metaErrorCode/httpStatus", () => {
    const error = new CapiApiError("boom", { metaErrorCode: 190, httpStatus: 401 });
    expect(error.metaErrorCode).toBe(190);
    expect(error.httpStatus).toBe(401);
  });

  it("leaves metaErrorCode/httpStatus undefined by default", () => {
    const error = new CapiApiError("boom");
    expect(error.metaErrorCode).toBeUndefined();
    expect(error.httpStatus).toBeUndefined();
  });

  it("accepts an explicit ErrorCode override", () => {
    const error = new CapiApiError("boom", {}, ErrorCode.RATE_LIMITED);
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
  });

  it("is a CapiError", () => {
    expect(new CapiApiError("boom").name).toBe("CapiApiError");
  });
});
