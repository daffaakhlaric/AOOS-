import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";

/**
 * A minimal spy-based `IPublisher` test double — mirrors
 * `packages/meta-ads-connector/tests/helpers/publisher.ts`'s pattern exactly (records every
 * `publish()` call for assertions, never touches a real `EventBroker`). Used to assert
 * `POST /webhooks/meta` actually results in a `LeadReceived` event being published, without
 * standing up the real `@aos/event-bus` dispatcher/subscription machinery.
 */
export interface FakePublisher extends IPublisher {
  readonly published: PublishInput[];
}

export function createFakePublisher(): FakePublisher {
  const published: PublishInput[] = [];
  const toShape = (input: PublishInput): BaseEventShape => ({
    eventId: `fake-${published.length}`,
    type: input.type,
    category: input.category,
    correlationId: input.correlationId ?? "fake-correlation",
    causationId: input.causationId,
    tenantId: input.tenantId,
    source: input.source,
    producer: input.producer,
    timestamp: new Date().toISOString(),
    priority: input.priority ?? ("NORMAL" as never),
    version: input.version ?? "1.0.0",
    schemaVersion: input.schemaVersion ?? "1.0.0",
    payload: input.payload,
    metadata: input.metadata,
    traceId: input.traceId,
  });

  return {
    published,
    publish: async (input: PublishInput) => {
      published.push(input);
      return toShape(input);
    },
    publishAsync: async (input: PublishInput) => {
      published.push(input);
      return toShape(input);
    },
    publishBatch: async (inputs: readonly PublishInput[]) => {
      published.push(...inputs);
      return inputs.map(toShape);
    },
  };
}
