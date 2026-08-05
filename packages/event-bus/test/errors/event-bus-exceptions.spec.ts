import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { EventBusException } from "../../src/errors/event-bus-exception.js";
import { PublishException } from "../../src/errors/publish-exception.js";
import { RetryExhaustedException } from "../../src/errors/retry-exhausted-exception.js";
import { RoutingException } from "../../src/errors/routing-exception.js";
import { SubscriptionException } from "../../src/errors/subscription-exception.js";
import { ValidationException } from "../../src/errors/validation-exception.js";

describe("Event Bus exception hierarchy", () => {
  it.each([
    ["EventBusException", EventBusException],
    ["ValidationException", ValidationException],
    ["RoutingException", RoutingException],
    ["PublishException", PublishException],
    ["SubscriptionException", SubscriptionException],
    ["RetryExhaustedException", RetryExhaustedException],
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
