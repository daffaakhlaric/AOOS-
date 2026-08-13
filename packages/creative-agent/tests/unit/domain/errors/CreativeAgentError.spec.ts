import { ErrorCode } from "@aos/common";
import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { CreativeAgentError } from "../../../../src/domain/errors/CreativeAgentError.js";

describe("CreativeAgentError", () => {
  it("extends AosError", () => {
    const error = new CreativeAgentError(ErrorCode.INTERNAL, "boom");
    expect(error).toBeInstanceOf(AosError);
  });

  it("carries the given code and message", () => {
    const error = new CreativeAgentError(ErrorCode.UNAVAILABLE, "orchestration failed");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error.message).toBe("orchestration failed");
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new CreativeAgentError(ErrorCode.INTERNAL, "wrapped", { cause });
    expect(error.cause).toBe(cause);
  });

  it("name reflects the concrete subclass via new.target", () => {
    const error = new CreativeAgentError(ErrorCode.INTERNAL, "x");
    expect(error.name).toBe("CreativeAgentError");
  });
});
