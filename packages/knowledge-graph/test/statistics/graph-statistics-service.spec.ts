import { describe, expect, it } from "vitest";

import { GraphStatisticsService } from "../../src/statistics/graph-statistics-service.js";
import { buildDagEngine } from "../helpers/graph-fixtures.js";

describe("GraphStatisticsService", () => {
  it("delegates to calculateGraphStatistics", () => {
    const service = new GraphStatisticsService();
    const engine = buildDagEngine();
    const stats = service.compute(engine);
    expect(stats.nodeCount).toBe(4);
    expect(stats.edgeCount).toBe(4);
  });
});
