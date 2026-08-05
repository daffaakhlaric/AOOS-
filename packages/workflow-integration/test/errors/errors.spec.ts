import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { AdapterAlreadyRegisteredException } from "../../src/errors/adapter-already-registered-exception.js";
import { AdapterNotFoundException } from "../../src/errors/adapter-not-found-exception.js";
import { CircularIntegrationException } from "../../src/errors/circular-integration-exception.js";
import { IntegrationPermissionException } from "../../src/errors/integration-permission-exception.js";
import { IntegrationRetryExhaustedException } from "../../src/errors/integration-retry-exhausted-exception.js";
import { IntegrationTimeoutException } from "../../src/errors/integration-timeout-exception.js";
import { IntegrationValidationException } from "../../src/errors/integration-validation-exception.js";
import { MissingRuntimeException } from "../../src/errors/missing-runtime-exception.js";
import { WorkflowIntegrationException } from "../../src/errors/workflow-integration-exception.js";

describe("Errors Test — @aos/workflow-integration exception hierarchy", () => {
  it("WorkflowIntegrationException extends AosError and carries its message", () => {
    const error = new WorkflowIntegrationException("base failure");
    expect(error).toBeInstanceOf(AosError);
    expect(error.message).toBe("base failure");
  });

  it.each([
    ["AdapterAlreadyRegisteredException", AdapterAlreadyRegisteredException],
    ["AdapterNotFoundException", AdapterNotFoundException],
    ["CircularIntegrationException", CircularIntegrationException],
    ["IntegrationPermissionException", IntegrationPermissionException],
    ["IntegrationRetryExhaustedException", IntegrationRetryExhaustedException],
    ["IntegrationTimeoutException", IntegrationTimeoutException],
    ["IntegrationValidationException", IntegrationValidationException],
    ["MissingRuntimeException", MissingRuntimeException],
  ] as const)(
    "%s extends WorkflowIntegrationException and preserves its message",
    (_name, ExceptionClass) => {
      const error = new ExceptionClass("something went wrong");
      expect(error).toBeInstanceOf(WorkflowIntegrationException);
      expect(error).toBeInstanceOf(AosError);
      expect(error.message).toBe("something went wrong");
    },
  );

  it("accepts an optional cause/context via options", () => {
    const cause = new Error("root cause");
    const error = new AdapterNotFoundException("not found", {
      cause,
      context: { namespace: "capability" },
    });
    expect(error.cause).toBe(cause);
  });
});
