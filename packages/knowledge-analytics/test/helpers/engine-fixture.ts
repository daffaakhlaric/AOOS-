import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";
import { createSteppingClock } from "../../src/utils/clock.js";

import { FIXED_TIMESTAMP } from "./fixtures.js";

/** Builds a `KnowledgeAnalyticsEngine` wired to a deterministic, monotonically-advancing clock. */
export function createTestEngine(): KnowledgeAnalyticsEngine {
  return new KnowledgeAnalyticsEngine({ clock: createSteppingClock(FIXED_TIMESTAMP, 1) });
}
