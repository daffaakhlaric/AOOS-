import { describe, expect, it } from "vitest";

import { WorkflowDefinitionStatus } from "../../src/contracts/workflow-definition-status.js";
import { RegistryException } from "../../src/errors/registry-exception.js";
import { WorkflowDefinitionRegistry } from "../../src/registry/workflow-definition-registry.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Registry Test — WorkflowDefinitionRegistry", () => {
  it("registers a workflow and retrieves it by id and version", () => {
    const registry = new WorkflowDefinitionRegistry();
    const workflow = workflowFixture({ id: "wf-1", version: "1.0.0" });
    registry.register(workflow);
    const entry = registry.get("wf-1", "1.0.0");
    expect(entry?.workflow).toEqual(workflow);
    expect(entry?.status).toBe(WorkflowDefinitionStatus.DRAFT);
  });

  it("resolves the latest version when no version is given", () => {
    const registry = new WorkflowDefinitionRegistry();
    registry.register(workflowFixture({ id: "wf-1", version: "1.0.0" }));
    registry.register(workflowFixture({ id: "wf-1", version: "2.0.0" }));
    expect(registry.get("wf-1")?.workflow.version).toBe("2.0.0");
  });

  it("returns undefined when getting an unknown id", () => {
    const registry = new WorkflowDefinitionRegistry();
    expect(registry.get("ghost")).toBeUndefined();
  });

  it("throws RegistryException when registering a duplicate id@version", () => {
    const registry = new WorkflowDefinitionRegistry();
    const workflow = workflowFixture({ id: "wf-1", version: "1.0.0" });
    registry.register(workflow);
    expect(() => registry.register(workflow)).toThrow(RegistryException);
  });

  it("lists all entries, optionally filtered by tenantId", () => {
    const registry = new WorkflowDefinitionRegistry();
    registry.register(workflowFixture({ id: "wf-1", version: "1.0.0", tenantId: "tenant-a" }));
    registry.register(workflowFixture({ id: "wf-2", version: "1.0.0", tenantId: "tenant-b" }));
    expect(registry.list()).toHaveLength(2);
    expect(registry.list("tenant-a")).toHaveLength(1);
  });

  it("lists versions for an id", () => {
    const registry = new WorkflowDefinitionRegistry();
    registry.register(workflowFixture({ id: "wf-1", version: "1.0.0" }));
    registry.register(workflowFixture({ id: "wf-1", version: "1.1.0" }));
    expect(registry.versions("wf-1")).toEqual(["1.0.0", "1.1.0"]);
  });

  it("removes a registered entry", () => {
    const registry = new WorkflowDefinitionRegistry();
    registry.register(workflowFixture({ id: "wf-1", version: "1.0.0" }));
    registry.remove("wf-1", "1.0.0");
    expect(registry.get("wf-1", "1.0.0")).toBeUndefined();
    expect(registry.versions("wf-1")).toEqual([]);
  });

  it("throws RegistryException when removing an unregistered entry", () => {
    const registry = new WorkflowDefinitionRegistry();
    expect(() => registry.remove("ghost", "1.0.0")).toThrow(RegistryException);
  });

  it("transitions status via setStatus() following the allowed lifecycle", () => {
    const registry = new WorkflowDefinitionRegistry();
    registry.register(workflowFixture({ id: "wf-1", version: "1.0.0" }));
    const updated = registry.setStatus("wf-1", "1.0.0", WorkflowDefinitionStatus.PUBLISHED);
    expect(updated.status).toBe(WorkflowDefinitionStatus.PUBLISHED);
  });

  it("throws RegistryException when setStatus() targets an unregistered entry", () => {
    const registry = new WorkflowDefinitionRegistry();
    expect(() => registry.setStatus("ghost", "1.0.0", WorkflowDefinitionStatus.PUBLISHED)).toThrow(
      RegistryException,
    );
  });

  it("throws RegistryException for a disallowed status transition (DRAFT -> DEPRECATED)", () => {
    const registry = new WorkflowDefinitionRegistry();
    registry.register(workflowFixture({ id: "wf-1", version: "1.0.0" }));
    expect(() => registry.setStatus("wf-1", "1.0.0", WorkflowDefinitionStatus.DEPRECATED)).toThrow(
      RegistryException,
    );
  });
});
