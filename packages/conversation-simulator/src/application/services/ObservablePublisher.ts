import {
  EventPriority,
  type BaseEventShape,
  type IPublisher,
  type PublishInput,
} from "@aos/event-bus";

/**
 * A recording `IPublisher` decorator — forwards every `publish*` call to a real downstream
 * publisher (never drops an event) while also keeping an in-process array the simulator reads
 * back from (design resolution #6: "subscribe to `@aos/event-bus` for this session's events
 * during the run, don't hand-roll your own scoring math"). Mirrors `@aos/sales-agent`'s own test
 * helper `createFakePublisher()` pattern exactly, generalized so it can wrap either a real bus
 * publisher or, in tests, another spy — this package composes a fresh one per `RunSimulation`
 * call so one session's events never leak into another's.
 */
export class ObservablePublisher implements IPublisher {
  readonly published: PublishInput[] = [];

  constructor(private readonly downstream?: IPublisher) {}

  async publish(input: PublishInput): Promise<BaseEventShape> {
    this.published.push(input);
    return (await this.downstream?.publish(input)) ?? this.toShape(input);
  }

  async publishAsync(input: PublishInput): Promise<BaseEventShape> {
    this.published.push(input);
    return (await this.downstream?.publishAsync(input)) ?? this.toShape(input);
  }

  async publishBatch(inputs: readonly PublishInput[]): Promise<readonly BaseEventShape[]> {
    this.published.push(...inputs);
    const forwarded = await this.downstream?.publishBatch(inputs);
    return forwarded ?? inputs.map((input) => this.toShape(input));
  }

  /** Events published since (and including) `fromIndex`, in order — used to slice out one turn's events. */
  since(fromIndex: number): ReadonlyArray<PublishInput> {
    return this.published.slice(fromIndex);
  }

  private toShape(input: PublishInput): BaseEventShape {
    return {
      eventId: `sim-${this.published.length}`,
      type: input.type,
      category: input.category,
      correlationId: input.correlationId ?? "sim-correlation",
      causationId: input.causationId,
      tenantId: input.tenantId,
      source: input.source,
      producer: input.producer,
      timestamp: new Date().toISOString(),
      priority: input.priority ?? EventPriority.NORMAL,
      version: input.version ?? "1.0.0",
      schemaVersion: input.schemaVersion ?? "1.0.0",
      payload: input.payload,
      metadata: input.metadata,
      traceId: input.traceId,
    };
  }
}
