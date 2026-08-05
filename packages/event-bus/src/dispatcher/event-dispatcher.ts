import type { BaseEventShape } from "../contracts/base-event.js";
import type { IDeadLetterQueue } from "../dead-letter/i-dead-letter-queue.js";
import { EventBusEventEmitter } from "../events/event-bus-event-emitter.js";
import { EventBusEventName } from "../events/event-bus-event-name.js";
import type { IEventBusMetrics } from "../metrics/i-event-bus-metrics.js";
import { RetryExecutor } from "../retry/retry-executor.js";
import type { ISubscriptionManager, Subscription } from "../subscriber/i-subscriber.js";
import type { ITracer } from "../tracing/i-tracer.js";
import type { TraceContext } from "../tracing/trace-context.js";
import { createChildSpan } from "../tracing/trace-context.js";
import { now } from "../utils/timing.js";

import type { DispatchSummary, IDispatcher, SubscriberDeliveryResult } from "./i-dispatcher.js";

export interface EventDispatcherOptions {
  readonly subscriptionManager: ISubscriptionManager;
  readonly metrics: IEventBusMetrics;
  readonly events?: EventBusEventEmitter;
  readonly tracer?: ITracer;
  readonly deadLetterQueue?: IDeadLetterQueue;
  /** Injectable so Retry tests don't wait on real timers. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Event Dispatcher (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md — "Event Dispatcher"): given a
 * validated event, finds every matching Subscription (via the Subscription Manager, which
 * already applies Routing + Filters), delivers to each under its Retry Policy, and reports
 * Metrics/Tracing/internal bus events for every outcome. A subscriber whose retries are
 * exhausted is reported as dropped and, if an `IDeadLetterQueue` is configured, enqueued
 * there — otherwise the delivery is simply dropped (per "DLQ: Interface only. Belum
 * persistence.").
 */
export class EventDispatcher implements IDispatcher {
  private readonly subscriptionManager: ISubscriptionManager;
  private readonly metrics: IEventBusMetrics;
  private readonly events: EventBusEventEmitter;
  private readonly tracer: ITracer | undefined;
  private readonly deadLetterQueue: IDeadLetterQueue | undefined;
  private readonly sleep: ((ms: number) => Promise<void>) | undefined;

  constructor(options: EventDispatcherOptions) {
    this.subscriptionManager = options.subscriptionManager;
    this.metrics = options.metrics;
    this.events = options.events ?? new EventBusEventEmitter();
    this.tracer = options.tracer;
    this.deadLetterQueue = options.deadLetterQueue;
    this.sleep = options.sleep;
  }

  async dispatch(event: BaseEventShape, traceContext?: TraceContext): Promise<DispatchSummary> {
    const matched = this.subscriptionManager.match(event);
    const results: SubscriberDeliveryResult[] = [];

    for (const subscription of matched) {
      results.push(await this.deliver(event, subscription, traceContext));
    }

    const delivered = results.filter((result) => result.delivered).length;
    return {
      eventId: event.eventId,
      matchedSubscribers: matched.length,
      delivered,
      dropped: results.length - delivered,
      results,
    };
  }

  private async deliver(
    event: BaseEventShape,
    subscription: Subscription,
    traceContext: TraceContext | undefined,
  ): Promise<SubscriberDeliveryResult> {
    const span = traceContext
      ? this.tracer?.startSpan(`deliver:${event.type}`, createChildSpan(traceContext), {
          subscriberId: subscription.subscriberId,
        })
      : undefined;
    const start = now();

    const executor = new RetryExecutor({
      policy: subscription.retryPolicy,
      sleep: this.sleep,
      onAttemptFailed: (metadata) => {
        if (metadata.attempt < metadata.maxAttempts) {
          this.metrics.recordRetried();
          this.events.emit(EventBusEventName.EVENT_RETRIED, {
            eventId: event.eventId,
            subscriberId: subscription.subscriberId,
            attempt: metadata.attempt,
          });
        }
      },
    });

    try {
      const outcome = await executor.execute(() => Promise.resolve(subscription.handler(event)));
      this.metrics.recordDelivered(now() - start);
      this.events.emit(EventBusEventName.EVENT_DELIVERED, {
        eventId: event.eventId,
        type: event.type,
        subscriberId: subscription.subscriberId,
      });
      span?.end({ delivered: true, attempts: outcome.metadata.attempt });
      return {
        subscriberId: subscription.subscriberId,
        delivered: true,
        attempts: outcome.metadata.attempt,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.metrics.recordDropped();
      this.events.emit(EventBusEventName.EVENT_DROPPED, { eventId: event.eventId, reason });
      if (this.deadLetterQueue) {
        await this.deadLetterQueue.enqueue({
          event,
          reason,
          failedAt: new Date().toISOString(),
        });
        this.events.emit(EventBusEventName.DLQ_ENQUEUED, { eventId: event.eventId, reason });
      }
      span?.end({ delivered: false, error: reason });
      return {
        subscriberId: subscription.subscriberId,
        delivered: false,
        attempts: subscription.retryPolicy.maxAttempts,
        error: reason,
      };
    }
  }
}
