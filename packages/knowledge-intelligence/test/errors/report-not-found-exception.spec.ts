import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceException } from "../../src/errors/knowledge-intelligence-exception.js";
import { ReportNotFoundException } from "../../src/errors/report-not-found-exception.js";

describe("ReportNotFoundException", () => {
  it("carries the report id and a stable code", () => {
    const error = new ReportNotFoundException("report-1");
    expect(error.code).toBe("REPORT_NOT_FOUND");
    expect(error.context).toEqual({ reportId: "report-1" });
    expect(error.message).toContain("report-1");
  });

  it("is a KnowledgeIntelligenceException", () => {
    expect(new ReportNotFoundException("x")).toBeInstanceOf(KnowledgeIntelligenceException);
  });
});
