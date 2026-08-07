import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";
import { vi } from "vitest";

export function fakePublisher(): { publisher: IPublisher; publish: ReturnType<typeof vi.fn> } {
  const publish = vi.fn(async (input: PublishInput): Promise<BaseEventShape> => ({
    eventId: "e-1",
    type: input.type,
    category: input.category,
    correlationId: input.correlationId ?? "corr-1",
    source: input.source,
    producer: input.producer,
    timestamp: "2026-01-01T00:00:00.000Z",
    priority: input.priority as never,
    version: "1.0.0",
    schemaVersion: "1.0.0",
    payload: input.payload,
    tenantId: input.tenantId,
  }));
  return { publisher: { publish, publishAsync: publish, publishBatch: vi.fn() }, publish };
}
