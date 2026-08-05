import type { BaseEventShape, IPublisher, PublishInput } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { WorkflowDefinitionSystem } from "../../src/bootstrap/workflow-definition-system.js";
import { WorkflowDefinitionRegistry } from "../../src/registry/workflow-definition-registry.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

function fakePublisher(): IPublisher {
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
  return { publish, publishAsync: publish, publishBatch: vi.fn() };
}

describe("Bootstrap Test — WorkflowDefinitionSystem (IModule)", () => {
  it("exposes name/version and a ready-to-use service", async () => {
    const system = new WorkflowDefinitionSystem(fakePublisher());
    expect(system.name).toBe("WorkflowDefinitionSystemModule");
    expect(system.version).toBe("0.1.0");
    const entry = await system.service.createDefinition(workflowFixture());
    expect(entry.workflow.id).toBe("sample-workflow");
  });

  it("accepts a custom registry via config", () => {
    const registry = new WorkflowDefinitionRegistry();
    const system = new WorkflowDefinitionSystem(fakePublisher(), { registry });
    expect(system.service.registry).toBe(registry);
  });

  it("onBootstrap() and onShutdown() resolve without error", async () => {
    const system = new WorkflowDefinitionSystem(fakePublisher());
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});
