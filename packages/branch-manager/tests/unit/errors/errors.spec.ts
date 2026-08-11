import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import {
  AssignmentError,
  BranchConfigError,
  BranchManagerError,
  BranchNotFoundError,
  NoAvailableSalesError,
  SalesHumanNotFoundError,
} from "../../../src/domain/errors/index.js";

describe("BranchManagerError hierarchy", () => {
  it("BranchManagerError carries the given code and message", () => {
    const error = new BranchManagerError(ErrorCode.INTERNAL, "boom");
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.message).toBe("boom");
    expect(error.name).toBe("BranchManagerError");
  });

  it("BranchNotFoundError uses NOT_FOUND", () => {
    const error = new BranchNotFoundError("no branch");
    expect(error).toBeInstanceOf(BranchManagerError);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.name).toBe("BranchNotFoundError");
  });

  it("SalesHumanNotFoundError uses NOT_FOUND", () => {
    const error = new SalesHumanNotFoundError("no sales");
    expect(error).toBeInstanceOf(BranchManagerError);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("NoAvailableSalesError uses UNAVAILABLE", () => {
    const error = new NoAvailableSalesError("none available");
    expect(error).toBeInstanceOf(BranchManagerError);
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("AssignmentError uses CONFLICT", () => {
    const error = new AssignmentError("queue full");
    expect(error).toBeInstanceOf(BranchManagerError);
    expect(error.code).toBe(ErrorCode.CONFLICT);
  });

  it("BranchConfigError uses VALIDATION_ERROR", () => {
    const error = new BranchConfigError("invalid config");
    expect(error).toBeInstanceOf(BranchManagerError);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("carries options (cause/context) through", () => {
    const cause = new Error("root cause");
    const error = new AssignmentError("queue full", { cause, context: { tenantId: "t1" } });
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tenantId: "t1" });
  });
});
