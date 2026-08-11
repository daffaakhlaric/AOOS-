import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import {
  ForecastError,
  InvalidObjectiveError,
  ObjectiveError,
  ObjectiveNotFoundError,
} from "../../../../src/domain/errors/index.js";

describe("ObjectiveError", () => {
  it("is the base class extended by every other error", () => {
    const error = new ObjectiveError(ErrorCode.INTERNAL, "boom");
    expect(error.message).toBe("boom");
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error).toBeInstanceOf(Error);
  });

  it("carries options (cause) through to the base class", () => {
    const cause = new Error("root cause");
    const error = new ObjectiveError(ErrorCode.INTERNAL, "boom", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("ObjectiveNotFoundError", () => {
  it("maps to ErrorCode.NOT_FOUND", () => {
    const error = new ObjectiveNotFoundError("no such objective");
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.message).toBe("no such objective");
    expect(error).toBeInstanceOf(ObjectiveError);
  });

  it("propagates context via options", () => {
    const cause = new Error("underlying");
    const error = new ObjectiveNotFoundError("no such objective", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("InvalidObjectiveError", () => {
  it("maps to ErrorCode.VALIDATION_ERROR", () => {
    const error = new InvalidObjectiveError("bad input");
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe("bad input");
    expect(error).toBeInstanceOf(ObjectiveError);
  });

  it("propagates context via options", () => {
    const cause = new Error("underlying");
    const error = new InvalidObjectiveError("bad input", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("ForecastError", () => {
  it("maps to ErrorCode.INTERNAL", () => {
    const error = new ForecastError("forecast failed");
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.message).toBe("forecast failed");
    expect(error).toBeInstanceOf(ObjectiveError);
  });

  it("propagates context via options", () => {
    const cause = new Error("underlying");
    const error = new ForecastError("forecast failed", { cause });
    expect(error.cause).toBe(cause);
  });
});
