import { describe, expect, it } from "vitest";

import { SynchronizationNotFoundException } from "../../src/errors/synchronization-not-found-exception.js";
import { KnowledgeSynchronizationManager } from "../../src/manager/knowledge-synchronization-manager.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeSynchronizationManager", () => {
  it("composes registry, session, statistics, and scheduler", () => {
    const manager = new KnowledgeSynchronizationManager();
    expect(manager.registry).toBeDefined();
    expect(manager.session).toBeDefined();
    expect(manager.statistics).toBeDefined();
    expect(manager.scheduler).toBeDefined();
  });

  it("registers and retrieves an execution by token", () => {
    const manager = new KnowledgeSynchronizationManager();
    const execution = executionFixture();
    manager.register(execution);
    expect(manager.get(execution.instance.token)).toBe(execution);
  });

  it("get() returns undefined for an unknown token", () => {
    const manager = new KnowledgeSynchronizationManager();
    expect(manager.get("missing")).toBeUndefined();
  });

  it("require() throws for an unknown token", () => {
    const manager = new KnowledgeSynchronizationManager();
    expect(() => manager.require("missing")).toThrow(SynchronizationNotFoundException);
  });

  it("update() replaces a registered execution", () => {
    const manager = new KnowledgeSynchronizationManager();
    const execution = executionFixture();
    manager.register(execution);
    const updated = { ...execution, changes: [] };
    manager.update(updated);
    expect(manager.get(execution.instance.token)).toBe(updated);
  });

  it("update() throws when the execution is not registered", () => {
    const manager = new KnowledgeSynchronizationManager();
    expect(() => manager.update(executionFixture())).toThrow(SynchronizationNotFoundException);
  });

  it("unregister() removes an execution", () => {
    const manager = new KnowledgeSynchronizationManager();
    const execution = executionFixture();
    manager.register(execution);
    manager.unregister(execution.instance.token);
    expect(manager.get(execution.instance.token)).toBeUndefined();
  });

  it("list() returns every registered execution", () => {
    const manager = new KnowledgeSynchronizationManager();
    manager.register(
      executionFixture({ instance: { ...executionFixture().instance, token: "stok_a" } }),
    );
    manager.register(
      executionFixture({ instance: { ...executionFixture().instance, token: "stok_b" } }),
    );
    expect(manager.list()).toHaveLength(2);
  });

  it("list(tenantId) filters by tenant", () => {
    const manager = new KnowledgeSynchronizationManager();
    manager.register(
      executionFixture({
        instance: { ...executionFixture().instance, token: "stok_a", tenantId: "tenant-a" },
      }),
    );
    manager.register(
      executionFixture({
        instance: { ...executionFixture().instance, token: "stok_b", tenantId: "tenant-b" },
      }),
    );
    expect(manager.list("tenant-a")).toHaveLength(1);
  });

  it("count() reports the number of registered executions", () => {
    const manager = new KnowledgeSynchronizationManager();
    expect(manager.count()).toBe(0);
    manager.register(executionFixture());
    expect(manager.count()).toBe(1);
  });
});
