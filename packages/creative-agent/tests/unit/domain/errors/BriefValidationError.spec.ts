import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { BriefValidationError } from "../../../../src/domain/errors/BriefValidationError.js";
import { CreativeAgentError } from "../../../../src/domain/errors/CreativeAgentError.js";

describe("BriefValidationError", () => {
  it("extends CreativeAgentError", () => {
    expect(new BriefValidationError("bad brief")).toBeInstanceOf(CreativeAgentError);
  });

  it("always uses ErrorCode.VALIDATION_ERROR", () => {
    expect(new BriefValidationError("bad brief").code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("name is 'BriefValidationError'", () => {
    expect(new BriefValidationError("bad brief").name).toBe("BriefValidationError");
  });
});
