import { describe, expect, it } from "vitest";

import { ALL_REPORT_TYPES, KnowledgeUpdateReportType } from "../../src/types/report-type.js";

describe("KnowledgeUpdateReportType", () => {
  it("defines exactly the 10 spec report types", () => {
    expect(Object.values(KnowledgeUpdateReportType)).toHaveLength(10);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeUpdateReportType);
    expect(new Set(values).size).toBe(values.length);
  });

  it("ALL_REPORT_TYPES matches Object.values", () => {
    expect(ALL_REPORT_TYPES).toEqual(Object.values(KnowledgeUpdateReportType));
  });

  it("includes every named report from the spec", () => {
    const expected = [
      "update_summary",
      "scheduler_report",
      "retry_report",
      "conflict_report",
      "refresh_report",
      "policy_report",
      "dependency_report",
      "validation_report",
      "statistics_report",
      "session_report",
    ];
    expect([...ALL_REPORT_TYPES].sort()).toEqual(expected.sort());
  });
});
