import { describe, expect, it } from "vitest";

import {
  AgentError,
  ConversationError,
  HandoffError,
  ScoringError,
} from "../../../../src/domain/errors/index.js";

describe("domain errors", () => {
  it("AgentError carries the given code and message", () => {
    const error = new AgentError("INTERNAL" as never, "boom");
    expect(error.message).toBe("boom");
    expect(error.name).toBe("AgentError");
  });

  it("ConversationError is an AgentError with VALIDATION_ERROR code", () => {
    const error = new ConversationError("bad conversation");
    expect(error).toBeInstanceOf(AgentError);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("bad conversation");
  });

  it("ScoringError is an AgentError with VALIDATION_ERROR code", () => {
    const error = new ScoringError("bad score");
    expect(error).toBeInstanceOf(AgentError);
    expect(error.code).toBe("VALIDATION_ERROR");
  });

  it("HandoffError is an AgentError with UNAVAILABLE code", () => {
    const error = new HandoffError("handoff failed");
    expect(error).toBeInstanceOf(AgentError);
    expect(error.code).toBe("UNAVAILABLE");
  });

  it("errors carry an optional cause via options", () => {
    const cause = new Error("root cause");
    const error = new ConversationError("wrapped", { cause });
    expect(error.cause).toBe(cause);
  });
});
