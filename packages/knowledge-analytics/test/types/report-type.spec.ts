import { describe, expect, it } from "vitest";

import { KnowledgeReportType } from "../../src/types/report-type.js";

describe("KnowledgeReportType", () => {
  it("defines exactly 10 report types", () => {
    expect(Object.keys(KnowledgeReportType)).toHaveLength(10);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeReportType);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes DashboardSnapshot as the 10th report type", () => {
    expect(KnowledgeReportType.DashboardSnapshot).toBe("dashboard_snapshot");
  });
});
