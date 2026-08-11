import { describe, expect, it } from "vitest";

import {
  AgentError,
  DecisionError,
  EscalationError,
  ExecutionError,
} from "../../../../src/domain/errors/index.js";

describe("domain/errors", () => {
  it("AgentError carries the given code and message", () => {
    const error = new AgentError("VALIDATION_ERROR" as never, "bad input");
    expect(error.message).toBe("bad input");
    expect(error.name).toBe("AgentError");
  });

  it("DecisionError is a VALIDATION_ERROR AgentError", () => {
    const error = new DecisionError("bad decision");
    expect(error).toBeInstanceOf(AgentError);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.name).toBe("DecisionError");
  });

  it("ExecutionError is an UNAVAILABLE AgentError", () => {
    const error = new ExecutionError("could not execute");
    expect(error).toBeInstanceOf(AgentError);
    expect(error.code).toBe("UNAVAILABLE");
    expect(error.name).toBe("ExecutionError");
  });

  it("EscalationError is a NOT_FOUND AgentError", () => {
    const error = new EscalationError("no such escalation");
    expect(error).toBeInstanceOf(AgentError);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.name).toBe("EscalationError");
  });

  it("errors carry an optional cause/context via AosErrorOptions", () => {
    const cause = new Error("root cause");
    const error = new DecisionError("wrapped", { cause, context: { tenantId: "dss-motor" } });
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tenantId: "dss-motor" });
  });

  it("toJSON returns a structured, log-safe representation", () => {
    const error = new ExecutionError("failed");
    const json = error.toJSON();
    expect(json).toMatchObject({ name: "ExecutionError", code: "UNAVAILABLE", message: "failed" });
  });
});
