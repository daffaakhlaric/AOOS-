import { describe, expect, it } from "vitest";

import { EventBusMetricsCollector } from "../../src/metrics/event-bus-metrics-collector.js";

describe("Metrics Test — EventBusMetricsCollector", () => {
  it("starts at all zeros", () => {
    const metrics = new EventBusMetricsCollector();
    expect(metrics.snapshot()).toEqual({
      published: 0,
      delivered: 0,
      dropped: 0,
      retried: 0,
      rejected: 0,
      avgLatencyMs: 0,
      queueDepth: 0,
      subscriberCount: 0,
    });
  });

  it("counts Published/Delivered/Dropped/Retried/Rejected independently", () => {
    const metrics = new EventBusMetricsCollector();
    metrics.recordPublished();
    metrics.recordPublished();
    metrics.recordDelivered(10);
    metrics.recordDropped();
    metrics.recordRetried();
    metrics.recordRejected();

    const snapshot = metrics.snapshot();
    expect(snapshot.published).toBe(2);
    expect(snapshot.delivered).toBe(1);
    expect(snapshot.dropped).toBe(1);
    expect(snapshot.retried).toBe(1);
    expect(snapshot.rejected).toBe(1);
  });

  it("computes Latency as the average of every recorded delivery", () => {
    const metrics = new EventBusMetricsCollector();
    metrics.recordDelivered(10);
    metrics.recordDelivered(20);
    metrics.recordDelivered(30);
    expect(metrics.snapshot().avgLatencyMs).toBe(20);
  });

  it("tracks Queue Depth and Subscriber Count as the latest set value", () => {
    const metrics = new EventBusMetricsCollector();
    metrics.setQueueDepth(5);
    metrics.setSubscriberCount(3);
    metrics.setQueueDepth(2);
    const snapshot = metrics.snapshot();
    expect(snapshot.queueDepth).toBe(2);
    expect(snapshot.subscriberCount).toBe(3);
  });
});
