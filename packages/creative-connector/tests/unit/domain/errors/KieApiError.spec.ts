import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CreativeConnectorError } from "../../../../src/domain/errors/CreativeConnectorError.js";
import { KieApiError } from "../../../../src/domain/errors/KieApiError.js";

describe("KieApiError", () => {
  it("defaults to ErrorCode.UNAVAILABLE", () => {
    const error = new KieApiError("network failure");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("is a CreativeConnectorError", () => {
    expect(new KieApiError("x")).toBeInstanceOf(CreativeConnectorError);
  });

  it("carries an optional httpStatus", () => {
    const error = new KieApiError("unauthorized", { httpStatus: 401 });
    expect(error.httpStatus).toBe(401);
  });

  it("httpStatus is undefined for a network-level failure", () => {
    const error = new KieApiError("network failure");
    expect(error.httpStatus).toBeUndefined();
  });
});
