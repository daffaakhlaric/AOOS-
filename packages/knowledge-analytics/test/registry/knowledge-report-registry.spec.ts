import { describe, expect, it } from "vitest";

import { ReportNotFoundException } from "../../src/errors/report-not-found-exception.js";
import { KnowledgeReportRegistry } from "../../src/registry/knowledge-report-registry.js";
import { KnowledgeAnalyticsReport } from "../../src/reports/knowledge-analytics-report.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";

function report(id: string): KnowledgeAnalyticsReport {
  return new KnowledgeAnalyticsReport({
    id,
    type: KnowledgeReportType.Summary,
    generatedAt: 0,
    sections: {},
  });
}

describe("KnowledgeReportRegistry", () => {
  it("adds and retrieves a report by id", () => {
    const registry = new KnowledgeReportRegistry();
    const r = report("r1");
    registry.add(r);
    expect(registry.get("r1")).toBe(r);
  });

  it("throws ReportNotFoundException from get() for an unknown id", () => {
    expect(() => new KnowledgeReportRegistry().get("missing")).toThrow(ReportNotFoundException);
  });

  it("tryGet returns undefined for an unknown id", () => {
    expect(new KnowledgeReportRegistry().tryGet("missing")).toBeUndefined();
  });

  it("has reports correctly", () => {
    const registry = new KnowledgeReportRegistry();
    expect(registry.has("r1")).toBe(false);
    registry.add(report("r1"));
    expect(registry.has("r1")).toBe(true);
  });

  it("lists every added report", () => {
    const registry = new KnowledgeReportRegistry();
    registry.add(report("r1"));
    registry.add(report("r2"));
    expect(registry.list()).toHaveLength(2);
  });

  it("removes a report and returns true", () => {
    const registry = new KnowledgeReportRegistry();
    registry.add(report("r1"));
    expect(registry.remove("r1")).toBe(true);
    expect(registry.has("r1")).toBe(false);
  });

  it("remove returns false for an unknown id", () => {
    expect(new KnowledgeReportRegistry().remove("missing")).toBe(false);
  });

  it("reports size", () => {
    const registry = new KnowledgeReportRegistry();
    registry.add(report("r1"));
    registry.add(report("r2"));
    expect(registry.size()).toBe(2);
  });

  it("clears every entry", () => {
    const registry = new KnowledgeReportRegistry();
    registry.add(report("r1"));
    registry.clear();
    expect(registry.size()).toBe(0);
  });

  it("overwrites an existing entry when the same id is added again", () => {
    const registry = new KnowledgeReportRegistry();
    registry.add(report("r1"));
    const updated = report("r1");
    registry.add(updated);
    expect(registry.get("r1")).toBe(updated);
  });
});
