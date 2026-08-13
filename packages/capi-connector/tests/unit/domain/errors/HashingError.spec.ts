import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { HashingError } from "../../../../src/domain/errors/HashingError.js";

describe("HashingError", () => {
  it("uses ErrorCode.VALIDATION_ERROR", () => {
    const error = new HashingError("bad phone");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.name).toBe("HashingError");
    expect(error.message).toBe("bad phone");
  });
});
