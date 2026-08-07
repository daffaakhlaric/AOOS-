import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeIntelligenceReportBuilder } from "../../src/builders/knowledge-intelligence-report-builder.js";
import { ReportType } from "../../src/types/report-type.js";
import { resetFixtureState, makeClock } from "../helpers/fixtures.js";

describe("KnowledgeIntelligenceReportBuilder", () => {
  beforeEach(() => resetFixtureState());

  it("builds a report of the requested type with a fresh id and timestamp", () => {
    const builder = new KnowledgeIntelligenceReportBuilder(makeClock(500));
    const report = builder.build({
      type: ReportType.Coverage,
      title: "Coverage",
      sections: { x: 1 },
    });
    expect(report.type).toBe(ReportType.Coverage);
    expect(report.generatedAt).toBe(500);
    expect(report.sections).toEqual({ x: 1 });
  });

  it("builds an executive summary report", () => {
    const builder = new KnowledgeIntelligenceReportBuilder(makeClock(0));
    const report = builder.buildExecutiveSummary({ highlights: [] });
    expect(report.type).toBe(ReportType.ExecutiveSummary);
    expect(report.title).toBe("Executive Summary");
  });

  it("assigns unique ids across builds", () => {
    const builder = new KnowledgeIntelligenceReportBuilder(makeClock(0));
    const first = builder.build({ type: ReportType.Health, title: "a", sections: {} });
    const second = builder.build({ type: ReportType.Health, title: "b", sections: {} });
    expect(first.id).not.toBe(second.id);
  });
});
