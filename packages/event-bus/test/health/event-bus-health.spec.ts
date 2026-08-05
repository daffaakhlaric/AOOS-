import { describe, expect, it } from "vitest";

import { EventBusHealth } from "../../src/health/event-bus-health.js";
import type { EventBusMetricsSnapshot } from "../../src/metrics/i-event-bus-metrics.js";

function metrics(overrides: Partial<EventBusMetricsSnapshot> = {}): EventBusMetricsSnapshot {
  return {
    published: 0,
    delivered: 0,
    dropped: 0,
    retried: 0,
    rejected: 0,
    avgLatencyMs: 0,
    queueDepth: 0,
    subscriberCount: 1,
    ...overrides,
  };
}

describe("Health Test — EventBusHealth", () => {
  it("reports Healthy across every component when metrics are clean", () => {
    const health = new EventBusHealth(() => metrics({ published: 10, delivered: 10 }));
    const report = health.check();
    expect(report.status).toBe("healthy");
    expect(report.publisher.status).toBe("healthy");
    expect(report.dispatcher.status).toBe("healthy");
    expect(report.subscriber.status).toBe("healthy");
    expect(report.router.status).toBe("healthy");
    expect(report.broker.status).toBe("healthy");
  });

  it("degrades Publisher health when the rejection ratio crosses 10%", () => {
    const health = new EventBusHealth(() => metrics({ published: 10, rejected: 2 }));
    expect(health.check().publisher.status).toBe("degraded");
  });

  it("marks Publisher unhealthy when the rejection ratio crosses 50%", () => {
    const health = new EventBusHealth(() => metrics({ published: 10, rejected: 6 }));
    expect(health.check().publisher.status).toBe("unhealthy");
  });

  it("degrades Dispatcher health when the drop ratio crosses 10%", () => {
    const health = new EventBusHealth(() => metrics({ published: 10, dropped: 2 }));
    expect(health.check().dispatcher.status).toBe("degraded");
  });

  it("marks Subscriber degraded when there are zero subscribers", () => {
    const health = new EventBusHealth(() => metrics({ subscriberCount: 0 }));
    expect(health.check().subscriber.status).toBe("degraded");
  });

  it("Broker status is the worst of its components", () => {
    const health = new EventBusHealth(() =>
      metrics({ published: 10, rejected: 6, subscriberCount: 0 }),
    );
    const report = health.check();
    expect(report.status).toBe("unhealthy");
    expect(report.broker.status).toBe("unhealthy");
  });

  it("does not divide by zero when published is 0", () => {
    const health = new EventBusHealth(() => metrics({ published: 0, rejected: 0 }));
    expect(health.check().publisher.status).toBe("healthy");
  });
});
