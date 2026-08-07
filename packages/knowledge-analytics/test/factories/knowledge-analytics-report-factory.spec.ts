import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsReportFactory } from "../../src/factories/knowledge-analytics-report-factory.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";
import { createFixedClock } from "../../src/utils/clock.js";

describe("KnowledgeAnalyticsReportFactory", () => {
  it("defaults to Summary type with empty sections", () => {
    const report = new KnowledgeAnalyticsReportFactory(createFixedClock(1000)).create();
    expect(report.type).toBe(KnowledgeReportType.Summary);
    expect(report.sections).toEqual({});
  });

  it("accepts a custom type and sections", () => {
    const report = new KnowledgeAnalyticsReportFactory().create({
      type: KnowledgeReportType.Usage,
      sections: { usage: { a: 1 } },
    });
    expect(report.type).toBe(KnowledgeReportType.Usage);
    expect(report.sections).toEqual({ usage: { a: 1 } });
  });

  it("generates an id automatically when none is supplied", () => {
    expect(new KnowledgeAnalyticsReportFactory().create().id.startsWith("report_")).toBe(true);
  });

  it("uses a supplied id verbatim", () => {
    expect(new KnowledgeAnalyticsReportFactory().create({ id: "custom" }).id).toBe("custom");
  });

  it("uses the injected clock when no generatedAt is supplied", () => {
    expect(new KnowledgeAnalyticsReportFactory(createFixedClock(999)).create().generatedAt).toBe(
      999,
    );
  });
});
