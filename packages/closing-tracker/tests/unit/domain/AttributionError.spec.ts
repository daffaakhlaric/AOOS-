import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { AttributionError } from "../../../src/domain/errors/AttributionError.js";
import { ClosingTrackerError } from "../../../src/domain/errors/ClosingTrackerError.js";

describe("AttributionError", () => {
  it("is a ClosingTrackerError with INTERNAL code", () => {
    const error = new AttributionError("attribution failed");
    expect(error).toBeInstanceOf(ClosingTrackerError);
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.name).toBe("AttributionError");
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new AttributionError("attribution failed", { cause });
    expect(error.cause).toBe(cause);
  });
});
