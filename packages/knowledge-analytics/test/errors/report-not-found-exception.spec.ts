import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsException } from "../../src/errors/knowledge-analytics-exception.js";
import { ReportNotFoundException } from "../../src/errors/report-not-found-exception.js";

describe("ReportNotFoundException", () => {
  it("is a KnowledgeAnalyticsException", () => {
    expect(new ReportNotFoundException("report_1")).toBeInstanceOf(KnowledgeAnalyticsException);
  });

  it("uses the REPORT_NOT_FOUND code", () => {
    expect(new ReportNotFoundException("report_1").code).toBe("REPORT_NOT_FOUND");
  });

  it("includes the report id in the message", () => {
    expect(new ReportNotFoundException("report_1").message).toContain("report_1");
  });

  it("includes the report id in context", () => {
    expect(new ReportNotFoundException("report_1").context).toEqual({ reportId: "report_1" });
  });
});
