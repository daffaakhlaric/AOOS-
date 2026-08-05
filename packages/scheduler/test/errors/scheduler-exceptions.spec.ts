import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { CronParseException } from "../../src/errors/cron-parse-exception.js";
import { DependencyException } from "../../src/errors/dependency-exception.js";
import { LockAcquisitionException } from "../../src/errors/lock-acquisition-exception.js";
import { PolicyViolationException } from "../../src/errors/policy-violation-exception.js";
import { RetryExhaustedException } from "../../src/errors/retry-exhausted-exception.js";
import { SchedulerException } from "../../src/errors/scheduler-exception.js";
import { StateTransitionException } from "../../src/errors/state-transition-exception.js";
import { ValidationException } from "../../src/errors/validation-exception.js";

describe("Scheduler exception hierarchy", () => {
  it.each([
    ["SchedulerException", SchedulerException],
    ["ValidationException", ValidationException],
    ["CronParseException", CronParseException],
    ["DependencyException", DependencyException],
    ["RetryExhaustedException", RetryExhaustedException],
    ["LockAcquisitionException", LockAcquisitionException],
    ["PolicyViolationException", PolicyViolationException],
    ["StateTransitionException", StateTransitionException],
  ])("%s extends AosError and carries its message/name/context", (name, ExceptionClass) => {
    const error = new ExceptionClass("boom", { context: { tenantId: "t-1" } });
    expect(error).toBeInstanceOf(AosError);
    expect(error.name).toBe(name);
    expect(error.message).toBe("boom");
    expect(error.context).toEqual({ tenantId: "t-1" });
  });

  it("carries a `cause` through to the underlying Error", () => {
    const cause = new Error("root cause");
    const error = new ValidationException("wrapped", { cause });
    expect(error.cause).toBe(cause);
  });
});
