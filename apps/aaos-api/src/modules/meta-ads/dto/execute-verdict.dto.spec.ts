import { describe, expect, it } from "vitest";

import { ExecuteVerdictBodySchema } from "./execute-verdict.dto.js";

describe("ExecuteVerdictBodySchema", () => {
  it("accepts a valid PAUSE verdict on an ad", () => {
    const result = ExecuteVerdictBodySchema.safeParse({
      verdict: "PAUSE",
      targetId: "120000000000003",
      targetType: "ad",
    });
    expect(result.success).toBe(true);
  });

  it.each(["PAUSE", "SCALE", "FIX", "REFRESH", "KEEP", "REVIEW"])(
    "accepts verdict %s",
    (verdict) => {
      const result = ExecuteVerdictBodySchema.safeParse({
        verdict,
        targetId: "id",
        targetType: "campaign",
      });
      expect(result.success).toBe(true);
    },
  );

  it("rejects an unrecognized verdict", () => {
    const result = ExecuteVerdictBodySchema.safeParse({
      verdict: "DELETE",
      targetId: "id",
      targetType: "ad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty targetId", () => {
    const result = ExecuteVerdictBodySchema.safeParse({
      verdict: "PAUSE",
      targetId: "",
      targetType: "ad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized targetType", () => {
    const result = ExecuteVerdictBodySchema.safeParse({
      verdict: "PAUSE",
      targetId: "id",
      targetType: "account",
    });
    expect(result.success).toBe(false);
  });
});
