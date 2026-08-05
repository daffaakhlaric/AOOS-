import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { WorkflowDefinitionService } from "../../src/bootstrap/workflow-definition-service.js";
import { WorkflowDefinitionStatus } from "../../src/contracts/workflow-definition-status.js";
import { RegistryException } from "../../src/errors/registry-exception.js";
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

function service(): { service: WorkflowDefinitionService; publish: ReturnType<typeof vi.fn> } {
  const { publisher, publish } = fakePublisher();
  return {
    service: new WorkflowDefinitionService({
      eventPublisher: new WorkflowDefinitionEventPublisher(publisher),
    }),
    publish,
  };
}

describe("Bootstrap Test — WorkflowDefinitionService", () => {
  it("createDefinition() registers and publishes CREATED only for a first version", async () => {
    const { service: svc, publish } = service();
    const entry = await svc.createDefinition(workflowFixture());
    expect(entry.status).toBe(WorkflowDefinitionStatus.DRAFT);
    expect(publish).toHaveBeenCalledTimes(1);
    expect((publish.mock.calls[0]![0] as PublishInput).type).toBe(
      WorkflowDefinitionEventType.CREATED,
    );
  });

  it("createDefinition() also publishes VERSIONED when it is not the first version", async () => {
    const { service: svc, publish } = service();
    await svc.createDefinition(workflowFixture({ version: "1.0.0" }));
    await svc.createDefinition(workflowFixture({ version: "1.1.0" }));
    expect(publish).toHaveBeenCalledTimes(3);
    expect((publish.mock.calls[2]![0] as PublishInput).type).toBe(
      WorkflowDefinitionEventType.VERSIONED,
    );
  });

  it("updateStatus() transitions the entry and publishes UPDATED", async () => {
    const { service: svc, publish } = service();
    const workflow = workflowFixture();
    await svc.createDefinition(workflow);
    const updated = await svc.updateStatus(
      workflow.id,
      workflow.version,
      WorkflowDefinitionStatus.PUBLISHED,
    );
    expect(updated.status).toBe(WorkflowDefinitionStatus.PUBLISHED);
    const last = publish.mock.calls.at(-1)![0] as PublishInput;
    expect(last.type).toBe(WorkflowDefinitionEventType.UPDATED);
    expect(last.payload).toMatchObject({ status: WorkflowDefinitionStatus.PUBLISHED });
  });

  it("deleteDefinition() removes the entry and publishes DELETED", async () => {
    const { service: svc, publish } = service();
    const workflow = workflowFixture();
    await svc.createDefinition(workflow);
    await svc.deleteDefinition(workflow.id, workflow.version);
    expect(svc.registry.get(workflow.id, workflow.version)).toBeUndefined();
    const last = publish.mock.calls.at(-1)![0] as PublishInput;
    expect(last.type).toBe(WorkflowDefinitionEventType.DELETED);
  });

  it("deleteDefinition() throws RegistryException for an unregistered workflow", async () => {
    const { service: svc } = service();
    await expect(svc.deleteDefinition("ghost", "1.0.0")).rejects.toThrow(RegistryException);
  });

  it("validateDefinition() runs the pipeline and publishes VALIDATED with the result", async () => {
    const { service: svc, publish } = service();
    const result = await svc.validateDefinition(workflowFixture());
    expect(result.valid).toBe(true);
    const last = publish.mock.calls.at(-1)![0] as PublishInput;
    expect(last.type).toBe(WorkflowDefinitionEventType.VALIDATED);
    expect(last.payload).toMatchObject({ valid: true, issueCount: 0 });
  });
});
