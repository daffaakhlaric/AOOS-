import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { CapabilityNotConfiguredException } from "../../src/errors/capability-not-configured-exception.js";
import { ExecutionNotFoundException } from "../../src/errors/execution-not-found-exception.js";
import { ExecutionTimeoutException } from "../../src/errors/execution-timeout-exception.js";
import { ExecutionValidationException } from "../../src/errors/execution-validation-exception.js";
import { GraphValidationException } from "../../src/errors/graph-validation-exception.js";
import { IllegalExecutionTransitionException } from "../../src/errors/illegal-execution-transition-exception.js";
import { RetryExhaustedException } from "../../src/errors/retry-exhausted-exception.js";
import { TransitionResolutionException } from "../../src/errors/transition-resolution-exception.js";
import { WorkflowExecutionException } from "../../src/errors/workflow-execution-exception.js";

describe("Errors Test — @aos/workflow-execution exception hierarchy", () => {
  it("WorkflowExecutionException extends AosError and carries its message", () => {
    const error = new WorkflowExecutionException("base failure");
    expect(error).toBeInstanceOf(AosError);
    expect(error.message).toBe("base failure");
  });

  it.each([
    ["ExecutionNotFoundException", ExecutionNotFoundException],
    ["ExecutionValidationException", ExecutionValidationException],
    ["IllegalExecutionTransitionException", IllegalExecutionTransitionException],
    ["RetryExhaustedException", RetryExhaustedException],
    ["TransitionResolutionException", TransitionResolutionException],
    ["CapabilityNotConfiguredException", CapabilityNotConfiguredException],
    ["ExecutionTimeoutException", ExecutionTimeoutException],
    ["GraphValidationException", GraphValidationException],
  ] as const)(
    "%s extends WorkflowExecutionException and preserves its message",
    (_name, ExceptionClass) => {
      const error = new ExceptionClass("something went wrong");
      expect(error).toBeInstanceOf(WorkflowExecutionException);
      expect(error).toBeInstanceOf(AosError);
      expect(error.message).toBe("something went wrong");
    },
  );

  it("accepts an optional cause/context via options", () => {
    const cause = new Error("root cause");
    const error = new ExecutionNotFoundException("not found", {
      cause,
      context: { workflowExecutionId: "wf-1" },
    });
    expect(error.cause).toBe(cause);
  });
});
