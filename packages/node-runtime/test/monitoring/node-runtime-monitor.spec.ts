import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { NodeRuntimeMetricsCollector } from "../../src/metrics/node-runtime-metrics-collector.js";
import { NodeRuntimeMonitor } from "../../src/monitoring/node-runtime-monitor.js";

describe("Monitoring Test — NodeRuntimeMonitor", () => {
  it("sample() combines a Metrics snapshot and a Health report with a timestamp", () => {
    const metrics = new NodeRuntimeMetricsCollector();
    metrics.recordNodeCreated(NodeType.CUSTOM);
    const monitor = new NodeRuntimeMonitor(metrics);

    const sample = monitor.sample();

    expect(sample.metrics.nodeCount).toBe(1);
    expect(sample.health.status).toBe("healthy");
    expect(new Date(sample.sampledAt).toString()).not.toBe("Invalid Date");
  });

  it("exposes the same NodeRuntimeHealth instance across samples", () => {
    const monitor = new NodeRuntimeMonitor(new NodeRuntimeMetricsCollector());
    monitor.health.recordError("validator", "schema drift");
    expect(monitor.sample().health.validator.status).toBe("unhealthy");
  });
});
