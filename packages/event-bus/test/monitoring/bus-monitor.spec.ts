import { describe, expect, it } from "vitest";

import { EventBusMetricsCollector } from "../../src/metrics/event-bus-metrics-collector.js";
import { BusMonitor } from "../../src/monitoring/bus-monitor.js";

describe("BusMonitor", () => {
  it("combines a Metrics snapshot and a Health check into one sample", () => {
    const metrics = new EventBusMetricsCollector();
    metrics.recordPublished();
    metrics.setSubscriberCount(2);
    const monitor = new BusMonitor(metrics);

    const sample = monitor.sample();
    expect(sample.metrics.published).toBe(1);
    expect(sample.health.status).toBe("healthy");
    expect(typeof sample.sampledAt).toBe("string");
  });
});
