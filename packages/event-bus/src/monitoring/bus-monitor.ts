import { EventBusHealth } from "../health/event-bus-health.js";
import type { EventBusHealthReport } from "../health/i-health-check.js";
import type { EventBusMetricsSnapshot, IEventBusMetrics } from "../metrics/i-event-bus-metrics.js";

export interface EventBusSnapshot {
  readonly metrics: EventBusMetricsSnapshot;
  readonly health: EventBusHealthReport;
  readonly sampledAt: string;
}

/**
 * Combines Metrics + Health into one Monitoring sample. Produces the payload shape a
 * `monitoring.*` event (contracts/monitoring-event.ts) carries when the Broker periodically
 * publishes one onto the bus itself — the actual publish call is wired at the Broker level
 * to avoid this module depending on publisher/.
 */
export class BusMonitor {
  private readonly health: EventBusHealth;

  constructor(private readonly metrics: IEventBusMetrics) {
    this.health = new EventBusHealth(() => this.metrics.snapshot());
  }

  sample(): EventBusSnapshot {
    return {
      metrics: this.metrics.snapshot(),
      health: this.health.check(),
      sampledAt: new Date().toISOString(),
    };
  }
}
