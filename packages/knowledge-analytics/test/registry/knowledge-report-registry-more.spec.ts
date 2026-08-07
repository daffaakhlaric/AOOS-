import { describe, expect, it } from "vitest";

import { KnowledgeReportRegistry } from "../../src/registry/knowledge-report-registry.js";
import { KnowledgeAnalyticsReport } from "../../src/reports/knowledge-analytics-report.js";
import { KnowledgeReportType } from "../../src/types/report-type.js";

function report(
  id: string,
  type: KnowledgeReportType = KnowledgeReportType.Summary,
): KnowledgeAnalyticsReport {
  return new KnowledgeAnalyticsReport({ id, type, generatedAt: 0, sections: {} });
}

describe("KnowledgeReportRegistry additional coverage", () => {
  it("supports storing every one of the 10 report types simultaneously", () => {
    const registry = new KnowledgeReportRegistry();
    let i = 0;
    for (const type of Object.values(KnowledgeReportType)) {
      registry.add(report(`r${i}`, type));
      i += 1;
    }
    expect(registry.size()).toBe(Object.values(KnowledgeReportType).length);
  });

  it("list() reflects removals immediately", () => {
    const registry = new KnowledgeReportRegistry();
    registry.add(report("r1"));
    registry.add(report("r2"));
    registry.remove("r1");
    expect(registry.list().map((r) => r.id)).toEqual(["r2"]);
  });

  it("clear() on an already-empty registry does not throw", () => {
    expect(() => new KnowledgeReportRegistry().clear()).not.toThrow();
  });

  it("size() is 0 for a fresh registry", () => {
    expect(new KnowledgeReportRegistry().size()).toBe(0);
  });
});
