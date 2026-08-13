import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CreativeConnectorError } from "../../../../src/domain/errors/CreativeConnectorError.js";
import { GenerationFailedError } from "../../../../src/domain/errors/GenerationFailedError.js";

describe("GenerationFailedError", () => {
  it("uses ErrorCode.UNAVAILABLE", () => {
    const error = new GenerationFailedError("generation failed");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("is a CreativeConnectorError", () => {
    expect(new GenerationFailedError("x")).toBeInstanceOf(CreativeConnectorError);
  });

  it("carries the originating successFlag (2 - failed)", () => {
    const error = new GenerationFailedError("failed", { successFlag: 2 });
    expect(error.successFlag).toBe(2);
  });

  it("carries the originating successFlag (3 - generation failed)", () => {
    const error = new GenerationFailedError("generation failed", { successFlag: 3 });
    expect(error.successFlag).toBe(3);
  });
});
