import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CreativeAgentError } from "../../../../src/domain/errors/CreativeAgentError.js";
import { GenerationError } from "../../../../src/domain/errors/GenerationError.js";

describe("GenerationError", () => {
  it("extends CreativeAgentError", () => {
    expect(new GenerationError("all images failed")).toBeInstanceOf(CreativeAgentError);
  });

  it("always uses ErrorCode.UNAVAILABLE", () => {
    expect(new GenerationError("all images failed").code).toBe(ErrorCode.UNAVAILABLE);
  });

  it("name is 'GenerationError'", () => {
    expect(new GenerationError("all images failed").name).toBe("GenerationError");
  });
});
