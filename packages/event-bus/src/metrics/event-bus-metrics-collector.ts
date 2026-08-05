import type { EventBusMetricsSnapshot, IEventBusMetrics } from "./i-event-bus-metrics.js";

/** Collects the Event Metrics enumerated in docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md. */
export class EventBusMetricsCollector implements IEventBusMetrics {
  private published = 0;
  private delivered = 0;
  private dropped = 0;
  private retried = 0;
  private rejected = 0;
  private latencyMsTotal = 0;
  private queueDepth = 0;
  private subscriberCount = 0;

  recordPublished(): void {
    this.published += 1;
  }

  recordDelivered(latencyMs: number): void {
    this.delivered += 1;
    this.latencyMsTotal += latencyMs;
  }

  recordDropped(): void {
    this.dropped += 1;
  }

  recordRetried(): void {
    this.retried += 1;
  }

  recordRejected(): void {
    this.rejected += 1;
  }

  setQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  setSubscriberCount(count: number): void {
    this.subscriberCount = count;
  }

  snapshot(): EventBusMetricsSnapshot {
    return {
      published: this.published,
      delivered: this.delivered,
      dropped: this.dropped,
      retried: this.retried,
      rejected: this.rejected,
      avgLatencyMs: this.delivered === 0 ? 0 : this.latencyMsTotal / this.delivered,
      queueDepth: this.queueDepth,
      subscriberCount: this.subscriberCount,
    };
  }
}
