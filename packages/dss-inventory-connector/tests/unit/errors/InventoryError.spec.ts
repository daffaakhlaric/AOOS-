import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { InventoryError } from "../../../src/domain/errors/InventoryError.js";

describe("InventoryError", () => {
  it("carries the given ErrorCode and message", () => {
    const error = new InventoryError(ErrorCode.INTERNAL, "boom");
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.message).toBe("boom");
    expect(error.name).toBe("InventoryError");
  });

  it("carries optional context", () => {
    const error = new InventoryError(ErrorCode.VALIDATION_ERROR, "bad", {
      context: { tenantId: "t1" },
    });
    expect(error.context).toEqual({ tenantId: "t1" });
  });
});
