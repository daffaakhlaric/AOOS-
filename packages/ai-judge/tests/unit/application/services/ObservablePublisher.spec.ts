import {
  EventCategory,
  EventPriority,
  type BaseEventShape,
  type IPublisher,
  type PublishInput,
} from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";

const basePayload = {
  type: "test.event",
  category: EventCategory.DOMAIN,
  payload: { a: 1 },
  source: "test",
  producer: "test",
};

describe("ObservablePublisher", () => {
  it("publish() records the input and returns a synthesized BaseEventShape when there is no downstream", async () => {
    const publisher = new ObservablePublisher();
    const shape = await publisher.publish(basePayload);
    expect(publisher.published).toHaveLength(1);
    expect(shape.type).toBe("test.event");
  });

  it("publishAsync() records the input", async () => {
    const publisher = new ObservablePublisher();
    await publisher.publishAsync(basePayload);
    expect(publisher.published).toHaveLength(1);
  });

  it("publishBatch() records every input in the batch", async () => {
    const publisher = new ObservablePublisher();
    const shapes = await publisher.publishBatch([basePayload, basePayload]);
    expect(publisher.published).toHaveLength(2);
    expect(shapes).toHaveLength(2);
  });

  it("forwards to a downstream publisher when one is supplied", async () => {
    const downstreamPublished: PublishInput[] = [];
    function toShape(input: PublishInput): BaseEventShape {
      return {
        eventId: "d1",
        type: input.type,
        category: input.category,
        correlationId: "x",
        source: input.source,
        producer: input.producer,
        timestamp: new Date().toISOString(),
        priority: EventPriority.NORMAL,
        version: "1.0.0",
        schemaVersion: "1.0.0",
        payload: input.payload,
      };
    }
    const downstream: IPublisher = {
      publish: (input) => {
        downstreamPublished.push(input);
        return Promise.resolve(toShape(input));
      },
      publishAsync: (input) => {
        downstreamPublished.push(input);
        return Promise.resolve(toShape(input));
      },
      publishBatch: (inputs) => {
        downstreamPublished.push(...inputs);
        return Promise.resolve(inputs.map(toShape));
      },
    };
    const publisher = new ObservablePublisher(downstream);
    await publisher.publish(basePayload);
    await publisher.publishAsync(basePayload);
    await publisher.publishBatch([basePayload]);
    expect(downstreamPublished).toHaveLength(3);
  });

  it("since() returns events published from the given index onward", async () => {
    const publisher = new ObservablePublisher();
    await publisher.publish(basePayload);
    const markerIndex = publisher.published.length;
    await publisher.publish({ ...basePayload, type: "second.event" });
    expect(publisher.since(markerIndex).map((e) => e.type)).toEqual(["second.event"]);
  });
});
