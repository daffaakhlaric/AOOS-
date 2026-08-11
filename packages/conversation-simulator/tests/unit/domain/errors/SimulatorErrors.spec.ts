import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { PersonaNotFoundError } from "../../../../src/domain/errors/PersonaNotFoundError.js";
import { SimulationTimeoutError } from "../../../../src/domain/errors/SimulationTimeoutError.js";
import { SimulatorError } from "../../../../src/domain/errors/SimulatorError.js";
import { PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";

describe("SimulatorError", () => {
  it("carries the given ErrorCode and message", () => {
    const error = new SimulatorError(ErrorCode.INTERNAL, "boom");
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.message).toBe("boom");
    expect(error).toBeInstanceOf(Error);
  });

  it("supports an optional cause", () => {
    const cause = new Error("root cause");
    const error = new SimulatorError(ErrorCode.INTERNAL, "boom", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe("PersonaNotFoundError", () => {
  it("is a SimulatorError with ErrorCode.NOT_FOUND and mentions the missing id", () => {
    const error = new PersonaNotFoundError(PersonaId.COLD_BUYER);
    expect(error).toBeInstanceOf(SimulatorError);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.message).toContain("cold_buyer");
  });

  it("accepts a raw string id too", () => {
    const error = new PersonaNotFoundError("not-a-real-id");
    expect(error.message).toContain("not-a-real-id");
  });
});

describe("SimulatorError toJSON()", () => {
  it("produces a structured, log-safe representation", () => {
    const error = new SimulatorError(ErrorCode.INTERNAL, "boom", { context: { tenantId: "t1" } });
    const json = error.toJSON();
    expect(json.name).toBe("SimulatorError");
    expect(json.code).toBe(ErrorCode.INTERNAL);
    expect(json.message).toBe("boom");
  });
});

describe("SimulationTimeoutError", () => {
  it("is a SimulatorError with ErrorCode.TIMEOUT and reports both budget and elapsed", () => {
    const error = new SimulationTimeoutError(30_000, 31_500);
    expect(error).toBeInstanceOf(SimulatorError);
    expect(error.code).toBe(ErrorCode.TIMEOUT);
    expect(error.message).toContain("30000");
    expect(error.message).toContain("31500");
  });
});
