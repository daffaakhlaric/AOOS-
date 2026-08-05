import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { WorkflowIntegrationEventPublisher } from "../../src/events/workflow-integration-event-publisher.js";
import { WorkflowIntegrationEventType } from "../../src/events/workflow-integration-event-type.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Events Test — WorkflowIntegrationEventPublisher", () => {
  it("publishes onto the injected IPublisher with LIFECYCLE category and Context metadata", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowIntegrationEventPublisher(publisher);
    const context = contextFixture({ tenantId: "tenant-1", correlationId: "corr-1" });

    await eventPublisher.publishIntegrationEvent(WorkflowIntegrationEventType.STARTED, context);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]?.[0];
    expect(input.type).toBe(WorkflowIntegrationEventType.STARTED);
    expect(input.category).toBe(EventCategory.LIFECYCLE);
    expect(input.tenantId).toBe("tenant-1");
    expect(input.correlationId).toBe("corr-1");
    expect(input.payload).toMatchObject({
      workflowId: context.workflowId,
      workflowInstanceId: context.workflowInstanceId,
      executionId: context.executionId,
    });
  });

  it("merges extra fields into the event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowIntegrationEventPublisher(publisher);
    const context = contextFixture();

    await eventPublisher.publishIntegrationEvent(
      WorkflowIntegrationEventType.ADAPTER_RESOLVED,
      context,
      {
        adapterName: "crm",
      },
    );

    expect(publish.mock.calls[0]?.[0].payload).toMatchObject({ adapterName: "crm" });
  });

  it("uses the default source 'workflow-integration' unless overridden", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowIntegrationEventPublisher(publisher);
    await eventPublisher.publishIntegrationEvent(
      WorkflowIntegrationEventType.COMPLETED,
      contextFixture(),
    );
    expect(publish.mock.calls[0]?.[0].source).toBe("workflow-integration");
    expect(publish.mock.calls[0]?.[0].producer).toBe("@aos/workflow-integration");
  });

  it("accepts a custom source override", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowIntegrationEventPublisher(publisher, "custom-source");
    await eventPublisher.publishIntegrationEvent(
      WorkflowIntegrationEventType.COMPLETED,
      contextFixture(),
    );
    expect(publish.mock.calls[0]?.[0].source).toBe("custom-source");
  });
});
