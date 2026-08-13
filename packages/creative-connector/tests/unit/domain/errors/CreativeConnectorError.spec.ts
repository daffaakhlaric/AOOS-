import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CreativeConnectorError } from "../../../../src/domain/errors/CreativeConnectorError.js";

describe("CreativeConnectorError", () => {
  it("carries the given code and message", () => {
    const error = new CreativeConnectorError(ErrorCode.INTERNAL, "boom");
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.message).toBe("boom");
    expect(error.name).toBe("CreativeConnectorError");
  });

  it("is an instance of Error", () => {
    const error = new CreativeConnectorError(ErrorCode.INTERNAL, "boom");
    expect(error).toBeInstanceOf(Error);
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new CreativeConnectorError(ErrorCode.INTERNAL, "boom", { cause });
    expect(error.cause).toBe(cause);
  });
});
