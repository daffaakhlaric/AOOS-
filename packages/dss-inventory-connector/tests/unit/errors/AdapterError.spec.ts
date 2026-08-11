import { ErrorCode } from "@aos/common";
import { describe, expect, it } from "vitest";

import { AdapterError } from "../../../src/domain/errors/AdapterError.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";

describe("AdapterError", () => {
  it("carries the source in both context and a direct field", () => {
    const error = new AdapterError("not configured", { source: SourceSystem.DMS });
    expect(error.code).toBe(ErrorCode.UNAVAILABLE);
    expect(error.source).toBe(SourceSystem.DMS);
    expect(error.context?.source).toBe(SourceSystem.DMS);
  });

  it("merges caller-provided context with source", () => {
    const error = new AdapterError("failed", {
      source: SourceSystem.API,
      context: { tenantId: "t1" },
    });
    expect(error.context).toEqual({ tenantId: "t1", source: SourceSystem.API });
  });
});
