import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { JudgeError } from "../../../../src/domain/errors/JudgeError.js";

describe("JudgeError", () => {
  it("carries a code and message, and is an instance of Error", () => {
    const e = new JudgeError(ErrorCode.INTERNAL, "something broke");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe(ErrorCode.INTERNAL);
    expect(e.message).toBe("something broke");
    expect(e.name).toBe("JudgeError");
  });

  it("carries optional context/cause through toJSON()", () => {
    const cause = new Error("root cause");
    const e = new JudgeError(ErrorCode.VALIDATION_ERROR, "bad input", {
      cause,
      context: { tenantId: "t1" },
    });
    const json = e.toJSON();
    expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(json.context).toEqual({ tenantId: "t1" });
    expect(e.cause).toBe(cause);
  });
});
