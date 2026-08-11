import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { UnitNotFoundError } from "../../../src/domain/errors/UnitNotFoundError.js";

describe("UnitNotFoundError", () => {
  it("uses ErrorCode.NOT_FOUND", () => {
    const error = new UnitNotFoundError("no unit");
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.name).toBe("UnitNotFoundError");
  });
});
