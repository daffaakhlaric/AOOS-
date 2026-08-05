import { describe, expect, it } from "vitest";

import { NodeInstanceNotFoundException } from "../../src/errors/node-instance-not-found-exception.js";
import { NodeExecutionCoordinator } from "../../src/runtime/node-execution-coordinator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("NodeExecutionCoordinator (internal)", () => {
  it("register()/get() round-trips an Execution by its Node Instance id", () => {
    const coordinator = new NodeExecutionCoordinator();
    const execution = executionFixture();
    coordinator.register(execution);
    expect(coordinator.get(execution.instance.id)).toBe(execution);
  });

  it("get() returns undefined for an unknown id", () => {
    expect(new NodeExecutionCoordinator().get("ghost")).toBeUndefined();
  });

  it("require() throws NodeInstanceNotFoundException for an unknown id", () => {
    expect(() => new NodeExecutionCoordinator().require("ghost")).toThrow(
      NodeInstanceNotFoundException,
    );
  });

  it("update() replaces the registered Execution for the same id", () => {
    const coordinator = new NodeExecutionCoordinator();
    const execution = executionFixture();
    coordinator.register(execution);
    const updated = {
      ...execution,
      instance: { ...execution.instance, metadata: { patched: true } },
    };
    coordinator.update(updated);
    expect(coordinator.get(execution.instance.id)).toBe(updated);
  });

  it("update() throws NodeInstanceNotFoundException when the id was never registered", () => {
    expect(() => new NodeExecutionCoordinator().update(executionFixture())).toThrow(
      NodeInstanceNotFoundException,
    );
  });

  it("remove() drops the Execution from the coordinator", () => {
    const coordinator = new NodeExecutionCoordinator();
    const execution = executionFixture();
    coordinator.register(execution);
    coordinator.remove(execution.instance.id);
    expect(coordinator.get(execution.instance.id)).toBeUndefined();
  });

  it("list() lists all registered Executions, optionally filtered by workflowInstanceId", () => {
    const coordinator = new NodeExecutionCoordinator();
    const a = executionFixture();
    const b = executionFixture();
    coordinator.register({ ...a, instance: { ...a.instance, workflowInstanceId: "wf-a" } });
    coordinator.register({ ...b, instance: { ...b.instance, workflowInstanceId: "wf-b" } });
    expect(coordinator.list()).toHaveLength(2);
    expect(coordinator.list("wf-a")).toHaveLength(1);
  });
});
