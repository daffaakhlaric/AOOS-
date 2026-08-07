import { describe, expect, it } from "vitest";

import { VersionNotFoundException } from "../../src/errors/version-not-found-exception.js";
import { KnowledgeVersionManager } from "../../src/manager/knowledge-version-manager.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeVersionManager", () => {
  it("composes registry/session/statistics", () => {
    const manager = new KnowledgeVersionManager();
    expect(manager.registry).toBeTruthy();
    expect(manager.session).toBeTruthy();
    expect(manager.statistics).toBeTruthy();
  });

  it("registers and gets an execution by token", () => {
    const manager = new KnowledgeVersionManager();
    const execution = executionFixture();
    manager.register(execution);
    expect(manager.get(execution.instance.token)).toEqual(execution);
  });

  it("get() returns undefined for an unknown token", () => {
    const manager = new KnowledgeVersionManager();
    expect(manager.get("missing")).toBeUndefined();
  });

  it("require() throws VersionNotFoundException for an unknown token", () => {
    const manager = new KnowledgeVersionManager();
    expect(() => manager.require("missing")).toThrow(VersionNotFoundException);
  });

  it("require() returns the execution when registered", () => {
    const manager = new KnowledgeVersionManager();
    const execution = executionFixture();
    manager.register(execution);
    expect(manager.require(execution.instance.token)).toEqual(execution);
  });

  it("update() overwrites an existing execution", () => {
    const manager = new KnowledgeVersionManager();
    const execution = executionFixture();
    manager.register(execution);
    const updated = { ...execution, history: [] };
    manager.update(updated);
    expect(manager.get(execution.instance.token)).toEqual(updated);
  });

  it("update() throws when the token isn't already registered", () => {
    const manager = new KnowledgeVersionManager();
    expect(() => manager.update(executionFixture())).toThrow(VersionNotFoundException);
  });

  it("unregister() removes an execution", () => {
    const manager = new KnowledgeVersionManager();
    const execution = executionFixture();
    manager.register(execution);
    manager.unregister(execution.instance.token);
    expect(manager.get(execution.instance.token)).toBeUndefined();
  });

  it("list() returns all executions, optionally filtered by tenantId", () => {
    const manager = new KnowledgeVersionManager();
    const context1 = contextFixture({ tenantId: "tenant-1", token: "kver_t1" });
    const context2 = contextFixture({ tenantId: "tenant-2", token: "kver_t2" });
    manager.register(executionFixture({ context: context1 }));
    manager.register(executionFixture({ context: context2 }));
    expect(manager.list()).toHaveLength(2);
    expect(manager.list("tenant-1")).toHaveLength(1);
  });

  it("count() reflects the number of registered executions", () => {
    const manager = new KnowledgeVersionManager();
    expect(manager.count()).toBe(0);
    manager.register(executionFixture());
    expect(manager.count()).toBe(1);
  });
});
