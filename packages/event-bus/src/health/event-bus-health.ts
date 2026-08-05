import type { EventBusMetricsSnapshot } from "../metrics/i-event-bus-metrics.js";

import type { ComponentHealth, EventBusHealthReport, HealthStatus } from "./i-health-check.js";

const STATUS_RANK: Readonly<Record<HealthStatus, number>> = {
  healthy: 0,
  degraded: 1,
  unhealthy: 2,
};

function worstOf(statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.reduce((worst, status) =>
    STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst,
  );
}

function ratioStatus(ratio: number, degradedAt: number, unhealthyAt: number): HealthStatus {
  if (ratio >= unhealthyAt) {
    return "unhealthy";
  }
  if (ratio >= degradedAt) {
    return "degraded";
  }
  return "healthy";
}

/** Derives Publisher/Subscriber/Dispatcher/Router/Broker Health from a live Metrics snapshot. */
export class EventBusHealth {
  constructor(private readonly getMetrics: () => EventBusMetricsSnapshot) {}

  check(): EventBusHealthReport {
    const metrics = this.getMetrics();
    const rejectionRatio = metrics.published === 0 ? 0 : metrics.rejected / metrics.published;
    const dropRatio = metrics.published === 0 ? 0 : metrics.dropped / metrics.published;

    const publisher: ComponentHealth = {
      status: ratioStatus(rejectionRatio, 0.1, 0.5),
      details: { published: metrics.published, rejected: metrics.rejected },
    };
    const dispatcher: ComponentHealth = {
      status: ratioStatus(dropRatio, 0.1, 0.5),
      details: { delivered: metrics.delivered, dropped: metrics.dropped },
    };
    const subscriber: ComponentHealth = {
      status: metrics.subscriberCount === 0 ? "degraded" : "healthy",
      details: { subscriberCount: metrics.subscriberCount },
    };
    // Router is stateless (pure pattern matching) — it degrades only if the components that
    // depend on it (dispatcher/publisher) are already unhealthy, never independently.
    const router: ComponentHealth = { status: "healthy" };

    const status = worstOf([publisher.status, dispatcher.status, subscriber.status, router.status]);
    const broker: ComponentHealth = { status, details: { queueDepth: metrics.queueDepth } };

    return { status, publisher, subscriber, dispatcher, router, broker };
  }
}
