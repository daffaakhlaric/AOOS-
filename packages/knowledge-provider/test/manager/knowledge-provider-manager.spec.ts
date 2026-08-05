import { describe, expect, it } from "vitest";

import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { KnowledgeProviderManager } from "../../src/manager/knowledge-provider-manager.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeProviderManager", () => {
  it("composes registry, session, and statistics", () => {
    const manager = new KnowledgeProviderManager();
    expect(manager.registry).toBeDefined();
    expect(manager.session).toBeDefined();
    expect(manager.statistics).toBeDefined();
  });

  it("registers and retrieves an execution by token", () => {
    const manager = new KnowledgeProviderManager();
    const execution = executionFixture();
    manager.register(execution);
    expect(manager.get(execution.instance.token)).toBe(execution);
  });

  it("get() returns undefined for an unknown token", () => {
    const manager = new KnowledgeProviderManager();
    expect(manager.get("missing")).toBeUndefined();
  });

  it("require() throws for an unknown token", () => {
    const manager = new KnowledgeProviderManager();
    expect(() => manager.require("missing")).toThrow(ProviderNotFoundException);
  });

  it("update() replaces a registered execution", () => {
    const manager = new KnowledgeProviderManager();
    const execution = executionFixture();
    manager.register(execution);
    const updated = { ...execution, history: [] };
    manager.update(updated);
    expect(manager.get(execution.instance.token)).toBe(updated);
  });

  it("update() throws when the execution is not registered", () => {
    const manager = new KnowledgeProviderManager();
    expect(() => manager.update(executionFixture())).toThrow(ProviderNotFoundException);
  });

  it("unregister() removes an execution", () => {
    const manager = new KnowledgeProviderManager();
    const execution = executionFixture();
    manager.register(execution);
    manager.unregister(execution.instance.token);
    expect(manager.get(execution.instance.token)).toBeUndefined();
  });

  it("list() returns every registered execution", () => {
    const manager = new KnowledgeProviderManager();
    manager.register(
      executionFixture({ instance: { ...executionFixture().instance, token: "ptok_a" } }),
    );
    manager.register(
      executionFixture({ instance: { ...executionFixture().instance, token: "ptok_b" } }),
    );
    expect(manager.list()).toHaveLength(2);
  });

  it("list(tenantId) filters by tenant", () => {
    const manager = new KnowledgeProviderManager();
    manager.register(
      executionFixture({
        instance: { ...executionFixture().instance, token: "ptok_a", tenantId: "tenant-a" },
      }),
    );
    manager.register(
      executionFixture({
        instance: { ...executionFixture().instance, token: "ptok_b", tenantId: "tenant-b" },
      }),
    );
    expect(manager.list("tenant-a")).toHaveLength(1);
  });

  it("count() reports the number of registered executions", () => {
    const manager = new KnowledgeProviderManager();
    expect(manager.count()).toBe(0);
    manager.register(executionFixture());
    expect(manager.count()).toBe(1);
  });
});
