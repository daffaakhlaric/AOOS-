import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { ClosingTrackerError } from "../../../src/domain/errors/ClosingTrackerError.js";
import { InsufficientDataError } from "../../../src/domain/errors/InsufficientDataError.js";

describe("InsufficientDataError", () => {
  it("is a ClosingTrackerError with NOT_FOUND code", () => {
    const error = new InsufficientDataError("no data");
    expect(error).toBeInstanceOf(ClosingTrackerError);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.name).toBe("InsufficientDataError");
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new InsufficientDataError("no data", { cause });
    expect(error.cause).toBe(cause);
  });
});
