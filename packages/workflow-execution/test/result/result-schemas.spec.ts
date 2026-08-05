import { describe, expect, it } from "vitest";

import { executionHistoryEntrySchema } from "../../src/result/execution-history.js";
import { executionResultSchema } from "../../src/result/execution-result.js";
import {
  EMPTY_EXECUTION_STATISTICS,
  executionStatisticsSchema,
} from "../../src/result/execution-statistics.js";
import { ExecutionState } from "../../src/state-machine/execution-state.js";

describe("result schemas", () => {
  it("executionHistoryEntrySchema requires fromState/toState/occurredAt", () => {
    expect(
      executionHistoryEntrySchema.safeParse({
        sequence: 0,
        fromState: ExecutionState.CREATED,
        toState: ExecutionState.READY,
        occurredAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
    expect(executionHistoryEntrySchema.safeParse({ sequence: 0 }).success).toBe(false);
  });

  it("executionResultSchema requires success and nodesVisited", () => {
    expect(
      executionResultSchema.safeParse({ success: true, nodesVisited: ["start"] }).success,
    ).toBe(true);
    expect(executionResultSchema.safeParse({}).success).toBe(false);
  });

  it("executionStatisticsSchema accepts EMPTY_EXECUTION_STATISTICS", () => {
    expect(executionStatisticsSchema.safeParse(EMPTY_EXECUTION_STATISTICS).success).toBe(true);
  });
});
