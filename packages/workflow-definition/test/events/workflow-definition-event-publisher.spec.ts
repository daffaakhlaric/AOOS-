import { EventCategory } from "@aos/event-bus";
import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { WorkflowDefinitionEventPublisher } from "../../src/events/workflow-definition-event-publisher.js";
import { WorkflowDefinitionEventType } from "../../src/events/workflow-definition-event-type.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

function fakePublisher(): { publisher: IPublisher; publish: ReturnType<typeof vi.fn> } {
  const publish = vi.fn(async (input: PublishInput): Promise<BaseEventShape> => ({
    eventId: "e-1",
    type: input.type,
    category: input.category,
    correlationId: "corr-1",
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

describe("Event Publishing Flow — WorkflowDefinitionEventPublisher", () => {
  it("publishes onto the Event Bus with the correct type/category/payload", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowDefinitionEventPublisher(publisher);
    const workflow = workflowFixture({ tenantId: "t-1" });

    await eventPublisher.publishDefinitionEvent(WorkflowDefinitionEventType.CREATED, workflow);

    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.type).toBe(WorkflowDefinitionEventType.CREATED);
    expect(input.category).toBe(EventCategory.DOMAIN);
    expect(input.tenantId).toBe("t-1");
    expect(input.producer).toBe("@aos/workflow-definition");
    expect(input.payload).toMatchObject({
      workflowId: workflow.id,
      version: workflow.version,
      nodeCount: workflow.nodes.length,
    });
  });

  it("merges extra payload fields (e.g. validation result)", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowDefinitionEventPublisher(publisher);
    const workflow = workflowFixture();

    await eventPublisher.publishDefinitionEvent(WorkflowDefinitionEventType.VALIDATED, workflow, {
      valid: false,
      issueCount: 2,
    });

    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.payload).toMatchObject({ valid: false, issueCount: 2 });
  });

  it("uses a custom source when supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowDefinitionEventPublisher(publisher, "custom-source");
    await eventPublisher.publishDefinitionEvent(
      WorkflowDefinitionEventType.CREATED,
      workflowFixture(),
    );
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.source).toBe("custom-source");
  });

  it("falls back to workflow id for payload.name when displayName is absent", async () => {
    const { publisher, publish } = fakePublisher();
    const eventPublisher = new WorkflowDefinitionEventPublisher(publisher);
    const workflow = workflowFixture({ id: "wf-no-name" });
    await eventPublisher.publishDefinitionEvent(WorkflowDefinitionEventType.CREATED, workflow);
    const input = publish.mock.calls[0]![0] as PublishInput;
    expect(input.payload).toMatchObject({ name: "wf-no-name" });
  });
});
