import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { BatchError } from "../../../../src/domain/errors/BatchError.js";

describe("BatchError", () => {
  it("uses ErrorCode.VALIDATION_ERROR", () => {
    const error = new BatchError("too many events");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.name).toBe("BatchError");
    expect(error.message).toBe("too many events");
  });
});
