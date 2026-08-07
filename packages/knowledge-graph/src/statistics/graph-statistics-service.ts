import { calculateGraphStatistics } from "../analytics/graph-statistics-calculator.js";
import type { GraphStatistics } from "../domain/graph-statistics.js";
import type { GraphEngine } from "../graph/graph-engine.js";

/**
 * Thin service boundary between `AnalyticsManager` and the `analytics/` algorithm module. Kept as
 * its own `statistics/` folder (per the spec's package structure) so statistics concerns
 * (formatting/exposure) stay separate from the raw algorithms in `analytics/`.
 */
export class GraphStatisticsService {
  compute(engine: GraphEngine): GraphStatistics {
    return calculateGraphStatistics(engine);
  }
}
