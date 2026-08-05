import { describe, expect, it } from "vitest";

import { InstanceNotFoundException } from "../../src/errors/instance-not-found-exception.js";
import { WorkflowExecutionCoordinator } from "../../src/execution/workflow-execution-coordinator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Execution Test — WorkflowExecutionCoordinator", () => {
  it("register()/get() round-trips an Execution by its ExecutionToken", () => {
    const coordinator = new WorkflowExecutionCoordinator();
    const execution = executionFixture();
    coordinator.register(execution);
    expect(coordinator.get(execution.instance.token)).toBe(execution);
  });

  it("get() returns undefined for an unknown token", () => {
    expect(new WorkflowExecutionCoordinator().get("wtok_ghost")).toBeUndefined();
  });

  it("require() throws InstanceNotFoundException for an unknown token", () => {
    const coordinator = new WorkflowExecutionCoordinator();
    expect(() => coordinator.require("wtok_ghost")).toThrow(InstanceNotFoundException);
  });

  it("update() replaces the registered Execution for the same token", () => {
    const coordinator = new WorkflowExecutionCoordinator();
    const execution = executionFixture();
    coordinator.register(execution);
    const updated = {
      ...execution,
      instance: { ...execution.instance, metadata: { patched: true } },
    };
    coordinator.update(updated);
    expect(coordinator.get(execution.instance.token)).toBe(updated);
  });

  it("update() throws InstanceNotFoundException when the token was never registered", () => {
    const coordinator = new WorkflowExecutionCoordinator();
    expect(() => coordinator.update(executionFixture())).toThrow(InstanceNotFoundException);
  });

  it("remove() drops the Execution from the coordinator", () => {
    const coordinator = new WorkflowExecutionCoordinator();
    const execution = executionFixture();
    coordinator.register(execution);
    coordinator.remove(execution.instance.token);
    expect(coordinator.get(execution.instance.token)).toBeUndefined();
  });

  it("list() lists all registered Executions, optionally filtered by tenantId", () => {
    const coordinator = new WorkflowExecutionCoordinator();
    const a = executionFixture();
    const b = executionFixture();
    coordinator.register({ ...a, instance: { ...a.instance, tenantId: "tenant-a" } });
    coordinator.register({ ...b, instance: { ...b.instance, tenantId: "tenant-b" } });
    expect(coordinator.list()).toHaveLength(2);
    expect(coordinator.list("tenant-a")).toHaveLength(1);
  });
});
