import { EventCategory } from "@aos/event-bus";
import type { PublishInput } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { WorkflowRuntimeEventPublisher } from "../../src/events/workflow-runtime-event-publisher.js";
import { WorkflowRuntimeEventType } from "../../src/events/workflow-runtime-event-type.js";
import { createWorkflowInstance } from "../../src/instance/create-workflow-instance.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Event Publishing Flow — WorkflowRuntimeEventPublisher", () => {
  it("publishes onto the Event Bus with the correct type/category/payload", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowRuntimeEventPublisher(publisher);
    const instance = createWorkflowInstance({
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      tenantId: "t-1",
    });

    await eventPublisher.publishInstanceEvent(WorkflowRuntimeEventType.CREATED, instance);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.type).toBe(WorkflowRuntimeEventType.CREATED);
    expect(input.category).toBe(EventCategory.LIFECYCLE);
    expect(input.tenantId).toBe("t-1");
    expect(input.producer).toBe("@aos/workflow-runtime");
    expect(input.payload).toMatchObject({
      instanceId: instance.id,
      token: instance.token,
      workflowId: "wf-1",
      workflowVersion: "1.0.0",
      status: instance.status,
    });
  });

  it("merges extra payload fields (e.g. a state transition)", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowRuntimeEventPublisher(publisher);
    const instance = createWorkflowInstance({ workflowId: "wf-1", workflowVersion: "1.0.0" });

    await eventPublisher.publishInstanceEvent(WorkflowRuntimeEventType.STATE_CHANGED, instance, {
      fromState: "created",
      toState: "ready",
    });

    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.payload).toMatchObject({ fromState: "created", toState: "ready" });
  });

  it("uses a custom source when supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowRuntimeEventPublisher(publisher, "custom-source");
    await eventPublisher.publishInstanceEvent(
      WorkflowRuntimeEventType.CREATED,
      createWorkflowInstance({ workflowId: "wf-1", workflowVersion: "1.0.0" }),
    );
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.source).toBe("custom-source");
  });
});
