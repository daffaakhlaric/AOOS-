import { describe, expect, it } from "vitest";

import { advanceCursor } from "../../src/cursor/advance-cursor.js";
import { ExecutionMetricsCollector } from "../../src/metrics/execution-metrics-collector.js";
import { ExecutionMonitor } from "../../src/monitoring/execution-monitor.js";
import { ExecutionState } from "../../src/state-machine/execution-state.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Monitoring Test — ExecutionMonitor", () => {
  it("sample() combines a Metrics snapshot and a Health report", () => {
    const metrics = new ExecutionMetricsCollector();
    const monitor = new ExecutionMonitor(metrics);
    const snapshot = monitor.sample();
    expect(snapshot.metrics.executionCount).toBe(0);
    expect(snapshot.health.status).toBe("healthy");
    expect(snapshot.sampledAt).toEqual(expect.any(String));
  });

  it("timeline() returns the session's ordered ExecutionHistory", () => {
    const metrics = new ExecutionMetricsCollector();
    const monitor = new ExecutionMonitor(metrics);
    const { session } = sessionFixture();
    const historyEntry = {
      sequence: 0,
      fromState: ExecutionState.CREATED,
      toState: ExecutionState.READY,
      occurredAt: new Date().toISOString(),
    };
    const withHistory = { ...session, history: [historyEntry] };
    expect(monitor.timeline(withHistory)).toEqual([historyEntry]);
  });

  it("tree() derives a parent->children view from the Cursor's execution path", () => {
    const metrics = new ExecutionMetricsCollector();
    const monitor = new ExecutionMonitor(metrics);
    const { session } = sessionFixture();
    let cursor = session.cursor;
    cursor = advanceCursor(cursor, "cap-1");
    cursor = advanceCursor(cursor, "end");
    const withCursor = { ...session, cursor };

    const tree = monitor.tree(withCursor);
    expect(tree).toEqual([
      { nodeId: "start", children: ["cap-1"] },
      { nodeId: "cap-1", children: ["end"] },
      { nodeId: "end", children: [] },
    ]);
  });

  it("trace() exposes traceId/correlationId/history from the session's token", () => {
    const metrics = new ExecutionMetricsCollector();
    const monitor = new ExecutionMonitor(metrics);
    const { session } = sessionFixture();
    const trace = monitor.trace(session);
    expect(trace.correlationId).toBe(session.context.token.correlationId);
    expect(trace.traceId).toBe(session.context.token.traceId);
    expect(trace.history).toBe(session.history);
  });
});
