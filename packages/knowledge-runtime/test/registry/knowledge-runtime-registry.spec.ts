import { describe, expect, it } from "vitest";

import { RuntimeInstanceNotFoundException } from "../../src/errors/runtime-instance-not-found-exception.js";
import { KnowledgeRuntimeRegistry } from "../../src/registry/knowledge-runtime-registry.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Registry Test — KnowledgeRuntimeRegistry", () => {
  it("register()/get() round-trips an Execution by token", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const registry = new KnowledgeRuntimeRegistry();
    registry.register(execution);
    expect(registry.get(execution.instance.token)).toBe(execution);
  });

  it("get() returns undefined for an unknown token", () => {
    const registry = new KnowledgeRuntimeRegistry();
    expect(registry.get("missing")).toBeUndefined();
  });

  it("require() throws RuntimeInstanceNotFoundException for an unknown token", () => {
    const registry = new KnowledgeRuntimeRegistry();
    expect(() => registry.require("missing")).toThrow(RuntimeInstanceNotFoundException);
  });

  it("update() replaces the registered Execution", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const registry = new KnowledgeRuntimeRegistry();
    registry.register(execution);
    const updated = {
      ...execution,
      instance: { ...execution.instance, updatedAt: "2026-01-01T00:00:00.000Z" },
    };
    registry.update(updated);
    expect(registry.get(execution.instance.token)?.instance.updatedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("update() throws RuntimeInstanceNotFoundException for an unregistered token", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const registry = new KnowledgeRuntimeRegistry();
    expect(() => registry.update(execution)).toThrow(RuntimeInstanceNotFoundException);
  });

  it("unregister() removes an Execution", async () => {
    const { asset } = await engineFixture();
    const execution = executionFixture(asset);
    const registry = new KnowledgeRuntimeRegistry();
    registry.register(execution);
    registry.unregister(execution.instance.token);
    expect(registry.get(execution.instance.token)).toBeUndefined();
  });

  it("list() returns every registered Execution, optionally filtered by tenantId", async () => {
    const { asset: assetA } = await engineFixture({ tenantId: "tenant-a" });
    const { asset: assetB } = await engineFixture({ tenantId: "tenant-b" });
    const registry = new KnowledgeRuntimeRegistry();
    registry.register(executionFixture(assetA));
    registry.register(executionFixture(assetB));
    expect(registry.list()).toHaveLength(2);
    expect(registry.list("tenant-a")).toHaveLength(1);
  });

  it("count() reports the number of registered Executions", async () => {
    const { asset } = await engineFixture();
    const registry = new KnowledgeRuntimeRegistry();
    expect(registry.count()).toBe(0);
    registry.register(executionFixture(asset));
    expect(registry.count()).toBe(1);
  });
});
