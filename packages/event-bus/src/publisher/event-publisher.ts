import type { BaseEventShape } from "../contracts/base-event.js";
import { extractEventNamespace } from "../contracts/event-namespace.js";
import { EVENT_PRIORITY_ORDER } from "../contracts/event-priority.js";
import type { IDispatcher } from "../dispatcher/i-dispatcher.js";
import { ValidationException } from "../errors/validation-exception.js";
import { EventBusEventEmitter } from "../events/event-bus-event-emitter.js";
import { EventBusEventName } from "../events/event-bus-event-name.js";
import type { IEventBusMetrics } from "../metrics/i-event-bus-metrics.js";
import { PriorityResolver } from "../priority/priority-resolver.js";
import type { ITracer } from "../tracing/i-tracer.js";
import { createTraceContext } from "../tracing/trace-context.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/timing.js";
import type { IEventValidator, ValidationContext } from "../validator/i-event-validator.js";
import { ValidationPipeline } from "../validator/validation-pipeline.js";

import type { IPublisher, PublishInput } from "./i-publisher.js";

export interface EventPublisherOptions {
  readonly dispatcher: IDispatcher;
  readonly metrics: IEventBusMetrics;
  readonly events?: EventBusEventEmitter;
  readonly tracer?: ITracer;
  readonly priorityResolver?: PriorityResolver;
  readonly validationContext?: ValidationContext;
  readonly extraValidators?: readonly IEventValidator[];
}

/** Publish / PublishAsync / PublishBatch. Fills every generated Event Contract field, then Validates, then Dispatches. */
export class EventPublisher implements IPublisher {
  private readonly dispatcher: IDispatcher;
  private readonly metrics: IEventBusMetrics;
  private readonly events: EventBusEventEmitter;
  private readonly tracer: ITracer | undefined;
  private readonly priorityResolver: PriorityResolver;
  private readonly validationContext: ValidationContext;
  private readonly pipeline: ValidationPipeline;

  constructor(options: EventPublisherOptions) {
    this.dispatcher = options.dispatcher;
    this.metrics = options.metrics;
    this.events = options.events ?? new EventBusEventEmitter();
    this.tracer = options.tracer;
    this.priorityResolver = options.priorityResolver ?? new PriorityResolver();
    this.validationContext = options.validationContext ?? {};
    this.pipeline = new ValidationPipeline(options.extraValidators);
  }

  async publish(input: PublishInput): Promise<BaseEventShape> {
    const event = this.buildAndValidate(input);
    this.recordPublished(event);
    const traceContext = createTraceContext(event.correlationId);
    this.tracer?.startSpan(`publish:${event.type}`, traceContext).end();
    await this.dispatcher.dispatch(event, traceContext);
    return event;
  }

  async publishAsync(input: PublishInput): Promise<BaseEventShape> {
    const event = this.buildAndValidate(input);
    this.recordPublished(event);
    const traceContext = createTraceContext(event.correlationId);
    // Intentionally not awaited — PublishAsync resolves once validated/enqueued, not once delivered.
    void this.dispatcher.dispatch(event, traceContext);
    return event;
  }

  async publishBatch(inputs: readonly PublishInput[]): Promise<readonly BaseEventShape[]> {
    const events = inputs.map((input) => this.buildEvent(input));
    const allIssues: { readonly index: number; readonly message: string }[] = [];
    events.forEach((event, index) => {
      const result = this.pipeline.run(event, this.validationContext);
      if (!result.valid) {
        allIssues.push(
          ...result.issues.map((issue) => ({
            index,
            message: `[${index}] ${issue.path}: ${issue.message}`,
          })),
        );
      }
    });
    if (allIssues.length > 0) {
      this.metrics.recordRejected();
      throw new ValidationException(
        `PublishBatch rejected: ${allIssues.map((issue) => issue.message).join("; ")}`,
      );
    }

    const ordered = [...events].sort(
      (a, b) => EVENT_PRIORITY_ORDER.indexOf(a.priority) - EVENT_PRIORITY_ORDER.indexOf(b.priority),
    );
    for (const event of ordered) {
      this.recordPublished(event);
      const traceContext = createTraceContext(event.correlationId);
      await this.dispatcher.dispatch(event, traceContext);
    }
    return ordered;
  }

  private buildAndValidate(input: PublishInput): BaseEventShape {
    const event = this.buildEvent(input);
    const result = this.pipeline.run(event, this.validationContext);
    if (!result.valid) {
      const reason = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
      this.metrics.recordRejected();
      this.events.emit(EventBusEventName.EVENT_REJECTED, { eventId: event.eventId, reason });
      throw new ValidationException(`Event "${event.type}" failed validation: ${reason}`);
    }
    return event;
  }

  private buildEvent(input: PublishInput): BaseEventShape {
    return {
      eventId: generateId(),
      type: input.type,
      category: input.category,
      correlationId: input.correlationId ?? generateId(),
      causationId: input.causationId,
      tenantId: input.tenantId,
      source: input.source,
      producer: input.producer,
      timestamp: new Date(now()).toISOString(),
      priority: input.priority ?? this.priorityResolver.resolve(extractEventNamespace(input.type)),
      version: input.version ?? "1.0.0",
      schemaVersion: input.schemaVersion ?? "1.0.0",
      payload: input.payload,
      metadata: input.metadata,
      traceId: input.traceId,
    };
  }

  private recordPublished(event: BaseEventShape): void {
    this.metrics.recordPublished();
    this.events.emit(EventBusEventName.EVENT_PUBLISHED, {
      eventId: event.eventId,
      type: event.type,
    });
  }
}
