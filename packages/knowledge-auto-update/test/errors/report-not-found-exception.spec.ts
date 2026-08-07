import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { ReportNotFoundException } from "../../src/errors/report-not-found-exception.js";

describe("ReportNotFoundException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new ReportNotFoundException("r-1")).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code REPORT_NOT_FOUND", () => {
    expect(new ReportNotFoundException("r-1").code).toBe("REPORT_NOT_FOUND");
  });

  it("includes the report id in message and context", () => {
    const error = new ReportNotFoundException("r-3");
    expect(error.message).toContain("r-3");
    expect(error.context).toEqual({ reportId: "r-3" });
  });
});
