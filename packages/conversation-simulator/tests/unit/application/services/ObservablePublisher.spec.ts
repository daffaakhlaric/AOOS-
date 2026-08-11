import { EventCategory, EventPriority } from "@aos/event-bus";
import type { IPublisher, PublishInput } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";

function samplePublishInput(overrides: Partial<PublishInput> = {}): PublishInput {
  return {
    type: "aaos.test.event",
    category: EventCategory.DOMAIN,
    payload: { hello: "world" },
    source: "test",
    producer: "test",
    tenantId: "tenant-x",
    correlationId: "corr-1",
    ...overrides,
  };
}

describe("ObservablePublisher", () => {
  it("publish() records the input and returns a shaped event", async () => {
    const publisher = new ObservablePublisher();
    const shape = await publisher.publish(samplePublishInput());
    expect(publisher.published).toHaveLength(1);
    expect(shape.type).toBe("aaos.test.event");
    expect(shape.priority).toBe(EventPriority.NORMAL);
  });

  it("publishAsync() records the input too", async () => {
    const publisher = new ObservablePublisher();
    await publisher.publishAsync(samplePublishInput({ type: "aaos.test.async" }));
    expect(publisher.published[0]?.type).toBe("aaos.test.async");
  });

  it("publishBatch() records every input in the batch", async () => {
    const publisher = new ObservablePublisher();
    await publisher.publishBatch([
      samplePublishInput({ type: "a" }),
      samplePublishInput({ type: "b" }),
    ]);
    expect(publisher.published.map((p) => p.type)).toEqual(["a", "b"]);
  });

  it("since(fromIndex) returns only events published after that index", async () => {
    const publisher = new ObservablePublisher();
    await publisher.publish(samplePublishInput({ type: "first" }));
    const markerIndex = publisher.published.length;
    await publisher.publish(samplePublishInput({ type: "second" }));
    await publisher.publish(samplePublishInput({ type: "third" }));
    expect(publisher.since(markerIndex).map((p) => p.type)).toEqual(["second", "third"]);
  });

  it("since(fromIndex) beyond the published length returns an empty array", () => {
    const publisher = new ObservablePublisher();
    expect(publisher.since(5)).toEqual([]);
  });

  it("forwards every publish* call to a downstream publisher when given one", async () => {
    const downstream: IPublisher = {
      publish: vi.fn(async (input: PublishInput) => ({
        eventId: "d1",
        type: input.type,
        category: input.category,
        correlationId: "d-corr",
        source: input.source,
        producer: input.producer,
        timestamp: new Date().toISOString(),
        priority: EventPriority.NORMAL,
        version: "1.0.0",
        schemaVersion: "1.0.0",
        payload: input.payload,
      })),
      publishAsync: vi.fn(async (input: PublishInput) => ({
        eventId: "d2",
        type: input.type,
        category: input.category,
        correlationId: "d-corr",
        source: input.source,
        producer: input.producer,
        timestamp: new Date().toISOString(),
        priority: EventPriority.NORMAL,
        version: "1.0.0",
        schemaVersion: "1.0.0",
        payload: input.payload,
      })),
      publishBatch: vi.fn(async (inputs: readonly PublishInput[]) =>
        inputs.map((input) => ({
          eventId: "d3",
          type: input.type,
          category: input.category,
          correlationId: "d-corr",
          source: input.source,
          producer: input.producer,
          timestamp: new Date().toISOString(),
          priority: EventPriority.NORMAL,
          version: "1.0.0",
          schemaVersion: "1.0.0",
          payload: input.payload,
        })),
      ),
    };
    const publisher = new ObservablePublisher(downstream);

    await publisher.publish(samplePublishInput());
    await publisher.publishAsync(samplePublishInput());
    await publisher.publishBatch([samplePublishInput()]);

    expect(downstream.publish).toHaveBeenCalledTimes(1);
    expect(downstream.publishAsync).toHaveBeenCalledTimes(1);
    expect(downstream.publishBatch).toHaveBeenCalledTimes(1);
    expect(publisher.published).toHaveLength(3);
  });

  it("defaults correlationId when the input omits it", async () => {
    const publisher = new ObservablePublisher();
    const input = samplePublishInput();
    delete (input as { correlationId?: string }).correlationId;
    const shape = await publisher.publish(input);
    expect(shape.correlationId).toBe("sim-correlation");
  });

  it("uses caller-supplied priority/version/schemaVersion when present", async () => {
    const publisher = new ObservablePublisher();
    const shape = await publisher.publish(
      samplePublishInput({
        priority: EventPriority.HIGH,
        version: "2.0.0",
        schemaVersion: "2.0.0",
      }),
    );
    expect(shape.priority).toBe(EventPriority.HIGH);
    expect(shape.version).toBe("2.0.0");
    expect(shape.schemaVersion).toBe("2.0.0");
  });
});
