import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { AosError } from "../src/aos-error.js";
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  RateLimitedError,
  TimeoutError,
  UnauthorizedError,
  UnavailableError,
  ValidationError,
} from "../src/specific-errors.js";
import { isAosError, toError } from "../src/type-guards.js";

describe("AosError", () => {
  it("carries a code, message, and optional context", () => {
    const error = new AosError(ErrorCode.INTERNAL, "boom", { context: { tenantId: "t1" } });
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.message).toBe("boom");
    expect(error.context?.tenantId).toBe("t1");
    expect(error.name).toBe("AosError");
  });

  it("toJSON produces a structured, log-safe shape", () => {
    const error = new AosError(ErrorCode.NOT_FOUND, "missing");
    expect(error.toJSON()).toMatchObject({
      name: "AosError",
      code: ErrorCode.NOT_FOUND,
      message: "missing",
    });
  });

  it("preserves the cause chain", () => {
    const cause = new Error("root cause");
    const error = new AosError(ErrorCode.INTERNAL, "wrapped", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("specific error subclasses", () => {
  const cases: Array<[new (message: string) => AosError, ErrorCode]> = [
    [ValidationError, ErrorCode.VALIDATION_ERROR],
    [NotFoundError, ErrorCode.NOT_FOUND],
    [UnauthorizedError, ErrorCode.UNAUTHORIZED],
    [ForbiddenError, ErrorCode.FORBIDDEN],
    [ConflictError, ErrorCode.CONFLICT],
    [TimeoutError, ErrorCode.TIMEOUT],
    [RateLimitedError, ErrorCode.RATE_LIMITED],
    [UnavailableError, ErrorCode.UNAVAILABLE],
    [InternalError, ErrorCode.INTERNAL],
  ];

  it.each(cases)("%s maps to the correct ErrorCode", (ErrorClass, expectedCode) => {
    const error = new ErrorClass("message");
    expect(error.code).toBe(expectedCode);
    expect(error.name).toBe(ErrorClass.name);
    expect(error).toBeInstanceOf(AosError);
  });
});

describe("type guards", () => {
  it("isAosError distinguishes AosError from a plain Error", () => {
    expect(isAosError(new ValidationError("x"))).toBe(true);
    expect(isAosError(new Error("x"))).toBe(false);
    expect(isAosError("not an error")).toBe(false);
  });

  it("toError normalizes any thrown value into an Error", () => {
    expect(toError(new Error("already an error")).message).toBe("already an error");
    expect(toError("string thrown").message).toBe("string thrown");
    expect(toError({ weird: true }).message).toContain("weird");
  });
});
