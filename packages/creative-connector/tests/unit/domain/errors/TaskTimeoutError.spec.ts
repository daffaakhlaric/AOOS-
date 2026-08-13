import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { CreativeConnectorError } from "../../../../src/domain/errors/CreativeConnectorError.js";
import { TaskTimeoutError } from "../../../../src/domain/errors/TaskTimeoutError.js";

describe("TaskTimeoutError", () => {
  it("uses ErrorCode.TIMEOUT", () => {
    const error = new TaskTimeoutError("timed out");
    expect(error.code).toBe(ErrorCode.TIMEOUT);
  });

  it("is a CreativeConnectorError", () => {
    expect(new TaskTimeoutError("x")).toBeInstanceOf(CreativeConnectorError);
  });
});
