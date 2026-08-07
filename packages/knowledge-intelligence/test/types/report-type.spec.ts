import { describe, expect, it } from "vitest";

import { ReportType } from "../../src/types/report-type.js";

describe("ReportType", () => {
  it("defines exactly the 14 spec'd report types", () => {
    expect(Object.values(ReportType)).toHaveLength(14);
  });

  it("has unique values", () => {
    const values = Object.values(ReportType);
    expect(new Set(values).size).toBe(values.length);
  });
});
