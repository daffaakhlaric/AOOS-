import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { InvalidSimulationError } from "../../../../src/domain/errors/InvalidSimulationError.js";
import { JudgeError } from "../../../../src/domain/errors/JudgeError.js";

describe("InvalidSimulationError", () => {
  it("is a JudgeError with VALIDATION_ERROR code and a prefixed message", () => {
    const e = new InvalidSimulationError("simulation has no messages to score");
    expect(e).toBeInstanceOf(JudgeError);
    expect(e.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(e.message).toBe("Cannot judge simulation: simulation has no messages to score");
    expect(e.name).toBe("InvalidSimulationError");
  });
});
