import { EventCategory } from "@aos/event-bus";
import type { PublishInput } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { NodeRuntimeEventPublisher } from "../../src/events/node-runtime-event-publisher.js";
import { NodeRuntimeEventType } from "../../src/events/node-runtime-event-type.js";
import { createNodeInstance } from "../../src/instance/create-node-instance.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Event Publishing Flow — NodeRuntimeEventPublisher", () => {
  it("publishes onto the Event Bus with the correct type/category/payload", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new NodeRuntimeEventPublisher(publisher);
    const instance = createNodeInstance({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });

    await eventPublisher.publishNodeEvent(NodeRuntimeEventType.CREATED, instance);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.type).toBe(NodeRuntimeEventType.CREATED);
    expect(input.category).toBe(EventCategory.LIFECYCLE);
    expect(input.producer).toBe("@aos/node-runtime");
    expect(input.payload).toMatchObject({
      nodeInstanceId: instance.id,
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
      status: instance.status,
    });
  });

  it("merges extra payload fields (e.g. a state transition)", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new NodeRuntimeEventPublisher(publisher);
    const instance = createNodeInstance({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });

    await eventPublisher.publishNodeEvent(NodeRuntimeEventType.STATE_CHANGED, instance, {
      fromState: "created",
      toState: "ready",
    });

    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.payload).toMatchObject({ fromState: "created", toState: "ready" });
  });

  it("uses a custom source when supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new NodeRuntimeEventPublisher(publisher, "custom-source");
    await eventPublisher.publishNodeEvent(
      NodeRuntimeEventType.CREATED,
      createNodeInstance({ workflowInstanceId: "wf-1", nodeId: "n-1", type: NodeType.CUSTOM }),
    );
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.source).toBe("custom-source");
  });
});
