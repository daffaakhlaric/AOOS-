import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";
import { vi } from "vitest";

/** A minimal spy-based `IPublisher` test double — records every `publish()` call's input for assertions, never touches a real broker/dispatcher. */
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
    publish: vi.fn(async (input: PublishInput) => {
      published.push(input);
      return toShape(input);
    }),
    publishAsync: vi.fn(async (input: PublishInput) => {
      published.push(input);
      return toShape(input);
    }),
    publishBatch: vi.fn(async (inputs: readonly PublishInput[]) => {
      published.push(...inputs);
      return inputs.map(toShape);
    }),
  };
}
