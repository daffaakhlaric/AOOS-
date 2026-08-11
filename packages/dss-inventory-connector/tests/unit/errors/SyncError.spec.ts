import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { SyncError } from "../../../src/domain/errors/SyncError.js";

describe("SyncError", () => {
  it("uses ErrorCode.UNAVAILABLE", () => {
    const error = new SyncError("sync failed");
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error.message).toBe("sync failed");
    expect(error.name).toBe("SyncError");
  });
});
