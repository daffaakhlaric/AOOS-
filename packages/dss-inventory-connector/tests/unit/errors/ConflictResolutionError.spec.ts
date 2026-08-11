import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { ConflictResolutionError } from "../../../src/domain/errors/ConflictResolutionError.js";

describe("ConflictResolutionError", () => {
  it("uses ErrorCode.CONFLICT", () => {
    const error = new ConflictResolutionError("could not reconcile");
    expect(error.code).toBe(ErrorCode.CONFLICT);
    expect(error.name).toBe("ConflictResolutionError");
  });
});
