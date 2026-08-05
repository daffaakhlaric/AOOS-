import { describe, expect, it } from "vitest";

import { InputOutputValidator } from "../../src/validator/input-output-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Validation Test — InputOutputValidator", () => {
  it("passes when input/output are absent", () => {
    expect(new InputOutputValidator().validate(executionFixture()).valid).toBe(true);
  });

  it("passes when input/output are plain objects", () => {
    const execution = executionFixture();
    const withIo = {
      ...execution,
      context: { ...execution.context, input: { a: 1 }, output: { b: 2 } },
    };
    expect(new InputOutputValidator().validate(withIo).valid).toBe(true);
  });

  it("fails when input is an array", () => {
    const execution = executionFixture();
    const badInput = {
      ...execution,
      context: { ...execution.context, input: [1, 2, 3] as unknown as Record<string, unknown> },
    };
    const result = new InputOutputValidator().validate(badInput);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "input")).toBe(true);
  });

  it("fails when output is an array", () => {
    const execution = executionFixture();
    const badOutput = {
      ...execution,
      context: { ...execution.context, output: [1] as unknown as Record<string, unknown> },
    };
    const result = new InputOutputValidator().validate(badOutput);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "output")).toBe(true);
  });
});
