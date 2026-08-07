import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeGapReportFactory } from "../../src/factories/knowledge-gap-report-factory.js";
import { resetFixtureState, makeClock } from "../helpers/fixtures.js";

describe("KnowledgeGapReportFactory", () => {
  beforeEach(() => resetFixtureState());

  it("creates a gap report with a fresh id and timestamp", () => {
    const factory = new KnowledgeGapReportFactory(makeClock(2000));
    const report = factory.create(75, [{ topic: "t", itemCount: 0 }], [{ itemId: "a" }]);
    expect(report.generatedAt).toBe(2000);
    expect(report.coverageScore).toBe(75);
    expect(report.gaps).toHaveLength(1);
    expect(report.orphans).toHaveLength(1);
  });
});
