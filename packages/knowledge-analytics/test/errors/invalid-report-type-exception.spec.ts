import { describe, expect, it } from "vitest";

import { InvalidReportTypeException } from "../../src/errors/invalid-report-type-exception.js";
import { KnowledgeAnalyticsException } from "../../src/errors/knowledge-analytics-exception.js";

describe("InvalidReportTypeException", () => {
  it("is a KnowledgeAnalyticsException", () => {
    expect(new InvalidReportTypeException("bogus")).toBeInstanceOf(KnowledgeAnalyticsException);
  });

  it("uses the INVALID_REPORT_TYPE code", () => {
    expect(new InvalidReportTypeException("bogus").code).toBe("INVALID_REPORT_TYPE");
  });

  it("produces an unrecognized-type message when no reason is given", () => {
    expect(new InvalidReportTypeException("bogus").message).toBe(
      '"bogus" is not a supported knowledge analytics report type',
    );
  });

  it("produces a reasoned message when a reason is given", () => {
    expect(new InvalidReportTypeException("usage_report", "missing section").message).toBe(
      '"usage_report" report cannot be built: missing section',
    );
  });

  it("stores reportType and reason in context", () => {
    const error = new InvalidReportTypeException("usage_report", "missing section");
    expect(error.context).toEqual({ reportType: "usage_report", reason: "missing section" });
  });

  it("stores an undefined reason in context when not given", () => {
    const error = new InvalidReportTypeException("bogus");
    expect(error.context).toEqual({ reportType: "bogus", reason: undefined });
  });
});
