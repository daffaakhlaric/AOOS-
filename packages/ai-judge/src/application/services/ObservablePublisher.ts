import {
  EventPriority,
  type BaseEventShape,
  type IPublisher,
  type PublishInput,
} from "@aos/event-bus";

/**
 * A recording `IPublisher` decorator — forwards every `publish*` call to a real downstream
 * publisher (never drops an event) while also keeping an in-process array callers/tests can read
 * back from. Mirrors `@aos/conversation-simulator`'s `ObservablePublisher` convention exactly —
 * `AiJudgeFactory` composes a fresh one per `create()` call so one workspace's events never leak
 * into another's.
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

  /** Events published since (and including) `fromIndex`, in order. */
  since(fromIndex: number): ReadonlyArray<PublishInput> {
    return this.published.slice(fromIndex);
  }

  private toShape(input: PublishInput): BaseEventShape {
    return {
      eventId: `judge-${this.published.length}`,
      type: input.type,
      category: input.category,
      correlationId: input.correlationId ?? "judge-correlation",
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
