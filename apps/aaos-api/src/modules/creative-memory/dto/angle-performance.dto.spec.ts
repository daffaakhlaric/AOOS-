import { describe, expect, it } from "vitest";

import { AnglePerformanceQuerySchema } from "./angle-performance.dto.js";

describe("AnglePerformanceQuerySchema", () => {
  it("accepts both since and until omitted (lifetime)", () => {
    expect(AnglePerformanceQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid since+until pair", () => {
    const result = AnglePerformanceQuerySchema.safeParse({
      since: "2026-01-01",
      until: "2026-01-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a lone since without until", () => {
    expect(AnglePerformanceQuerySchema.safeParse({ since: "2026-01-01" }).success).toBe(false);
  });

  it("rejects a lone until without since", () => {
    expect(AnglePerformanceQuerySchema.safeParse({ until: "2026-01-31" }).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(
      AnglePerformanceQuerySchema.safeParse({ since: "01-01-2026", until: "2026-01-31" }).success,
    ).toBe(false);
  });
});
