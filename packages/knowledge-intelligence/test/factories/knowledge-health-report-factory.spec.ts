import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeHealthReportFactory } from "../../src/factories/knowledge-health-report-factory.js";
import { HealthStatus } from "../../src/types/health-status.js";
import { KnowledgeHealthScore } from "../../src/value-objects/knowledge-health-score.js";
import { resetFixtureState, makeClock } from "../helpers/fixtures.js";

describe("KnowledgeHealthReportFactory", () => {
  beforeEach(() => resetFixtureState());

  it("creates a report with a fresh id and timestamp", () => {
    const factory = new KnowledgeHealthReportFactory(makeClock(1000));
    const overall = new KnowledgeHealthScore({
      overall: 80,
      quality: 80,
      freshness: 80,
      coverage: 80,
      risk: 20,
      status: HealthStatus.Healthy,
    });
    const report = factory.create(overall, [{ itemId: "a", score: overall }]);
    expect(report.generatedAt).toBe(1000);
    expect(report.itemScores).toHaveLength(1);
  });
});
