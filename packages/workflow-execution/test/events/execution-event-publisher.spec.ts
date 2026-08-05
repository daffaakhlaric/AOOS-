import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { ExecutionEventPublisher } from "../../src/events/execution-event-publisher.js";
import { ExecutionEventType } from "../../src/events/execution-event-type.js";
import { createExecutionToken } from "../../src/token/create-execution-token.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Events Test — ExecutionEventPublisher", () => {
  it("publishes onto the injected IPublisher with LIFECYCLE category and token metadata", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new ExecutionEventPublisher(publisher);
    const token = createExecutionToken({
      workflowInstanceId: "wf-instance-1",
      tenantId: "tenant-1",
      correlationId: "corr-1",
      traceId: "trace-1",
    });

    await eventPublisher.publishExecutionEvent(ExecutionEventType.WORKFLOW_STARTED, token);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]?.[0];
    expect(input.type).toBe(ExecutionEventType.WORKFLOW_STARTED);
    expect(input.category).toBe(EventCategory.LIFECYCLE);
    expect(input.tenantId).toBe("tenant-1");
    expect(input.correlationId).toBe("corr-1");
    expect(input.traceId).toBe("trace-1");
    expect(input.payload).toMatchObject({
      workflowExecutionId: token.workflowExecutionId,
      workflowInstanceId: token.workflowInstanceId,
      executionId: token.executionId,
    });
  });

  it("merges extra fields into the event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new ExecutionEventPublisher(publisher);
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });

    await eventPublisher.publishExecutionEvent(ExecutionEventType.NODE_FAILED, token, {
      nodeId: "cap-1",
      reason: "boom",
    });

    const input = publish.mock.calls[0]?.[0];
    expect(input.payload).toMatchObject({ nodeId: "cap-1", reason: "boom" });
  });

  it("uses the default source 'workflow-execution' unless overridden", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new ExecutionEventPublisher(publisher);
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });

    await eventPublisher.publishExecutionEvent(ExecutionEventType.WORKFLOW_COMPLETED, token);

    expect(publish.mock.calls[0]?.[0].source).toBe("workflow-execution");
    expect(publish.mock.calls[0]?.[0].producer).toBe("@aos/workflow-execution");
  });

  it("accepts a custom source override", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new ExecutionEventPublisher(publisher, "custom-source");
    const token = createExecutionToken({ workflowInstanceId: "wf-instance-1" });

    await eventPublisher.publishExecutionEvent(ExecutionEventType.WORKFLOW_COMPLETED, token);

    expect(publish.mock.calls[0]?.[0].source).toBe("custom-source");
  });
});
