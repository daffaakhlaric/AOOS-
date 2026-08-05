import type { BaseEventShape } from "../contracts/base-event.js";
import type { IRetryPolicy } from "../contracts/retry-policy.js";
import type { IDeadLetterQueue } from "../dead-letter/i-dead-letter-queue.js";
import { EventDispatcher } from "../dispatcher/event-dispatcher.js";
import { EventBusEventEmitter } from "../events/event-bus-event-emitter.js";
import { EventBusEventName } from "../events/event-bus-event-name.js";
import { EventBusHealth } from "../health/event-bus-health.js";
import type { EventBusHealthReport } from "../health/i-health-check.js";
import { EventBusMetricsCollector } from "../metrics/event-bus-metrics-collector.js";
import { BusMonitor, type EventBusSnapshot } from "../monitoring/bus-monitor.js";
import { PriorityResolver } from "../priority/priority-resolver.js";
import { EventPublisher } from "../publisher/event-publisher.js";
import type { PublishInput } from "../publisher/i-publisher.js";
import type { SubscribeInput } from "../subscriber/i-subscriber.js";
import { SubscriptionManager } from "../subscriber/subscription-manager.js";
import type { ITracer } from "../tracing/i-tracer.js";
import type { IEventValidator, ValidationContext } from "../validator/i-event-validator.js";

import type { IEventBroker } from "./i-broker.js";

export interface EventBrokerOptions {
  readonly defaultRetryPolicy?: IRetryPolicy;
  readonly priorityResolver?: PriorityResolver;
  readonly validationContext?: ValidationContext;
  readonly extraValidators?: readonly IEventValidator[];
  readonly tracer?: ITracer;
  readonly deadLetterQueue?: IDeadLetterQueue;
  /** Injectable so Retry tests don't wait on real timers. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * The Event Bus itself — "INI ADALAH CORE EVENT INFRASTRUCTURE untuk seluruh Autonomous
 * Operating System (AOS)" (docs/PROMPT-005.4-ENTERPRISE-EVENT-BUS.md). Composes
 * Validator → Publisher → Dispatcher → Subscription Manager (Router + Filter) →
 * Metrics/Tracing/Health/Monitoring behind one object, the same composition-root pattern
 * `RegistrySystem` (@aos/registry) and `Kernel` (@aos/runtime-kernel) use.
 */
export class EventBroker implements IEventBroker {
  readonly events = new EventBusEventEmitter();
  readonly metrics = new EventBusMetricsCollector();
  readonly subscriptions: SubscriptionManager;
  readonly dispatcher: EventDispatcher;
  private readonly publisher: EventPublisher;
  private readonly health: EventBusHealth;
  private readonly monitor: BusMonitor;

  constructor(options: EventBrokerOptions = {}) {
    this.subscriptions = new SubscriptionManager(options.defaultRetryPolicy);
    this.dispatcher = new EventDispatcher({
      subscriptionManager: this.subscriptions,
      metrics: this.metrics,
      events: this.events,
      tracer: options.tracer,
      deadLetterQueue: options.deadLetterQueue,
      sleep: options.sleep,
    });
    this.publisher = new EventPublisher({
      dispatcher: this.dispatcher,
      metrics: this.metrics,
      events: this.events,
      tracer: options.tracer,
      priorityResolver: options.priorityResolver ?? new PriorityResolver(),
      validationContext: options.validationContext,
      extraValidators: options.extraValidators,
    });
    this.health = new EventBusHealth(() => this.metrics.snapshot());
    this.monitor = new BusMonitor(this.metrics);
  }

  publish(input: PublishInput): Promise<BaseEventShape> {
    return this.publisher.publish(input);
  }

  publishAsync(input: PublishInput): Promise<BaseEventShape> {
    return this.publisher.publishAsync(input);
  }

  publishBatch(inputs: readonly PublishInput[]): Promise<readonly BaseEventShape[]> {
    return this.publisher.publishBatch(inputs);
  }

  subscribe(input: SubscribeInput): string {
    const subscriberId = this.subscriptions.subscribe(input);
    this.metrics.setSubscriberCount(this.subscriptions.count);
    this.events.emit(EventBusEventName.SUBSCRIBER_ADDED, {
      subscriberId,
      pattern: input.criteria.pattern ?? input.criteria.topic ?? input.criteria.namespace ?? "*",
    });
    return subscriberId;
  }

  unsubscribe(subscriberId: string): void {
    this.subscriptions.unsubscribe(subscriberId);
    this.metrics.setSubscriberCount(this.subscriptions.count);
    this.events.emit(EventBusEventName.SUBSCRIBER_REMOVED, { subscriberId });
  }

  get subscriberCount(): number {
    return this.subscriptions.count;
  }

  checkHealth(): EventBusHealthReport {
    return this.health.check();
  }

  monitorSnapshot(): EventBusSnapshot {
    return this.monitor.sample();
  }
}
