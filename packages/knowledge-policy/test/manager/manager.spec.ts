import { describe, expect, it } from "vitest";

import { KnowledgePolicyManager } from "../../src/manager/knowledge-policy-manager.js";
import { KnowledgePolicyRegistryBucket } from "../../src/registry/knowledge-policy-registry-bucket.js";
import { KnowledgePolicyRegistry } from "../../src/registry/knowledge-policy-registry.js";
import { KnowledgePolicySession } from "../../src/session/knowledge-policy-session.js";
import { executionFixture } from "../helpers/execution-fixture.js";

function buildManager() {
  const registry = new KnowledgePolicyRegistry();
  const session = new KnowledgePolicySession();
  const manager = new KnowledgePolicyManager(registry, session);
  return { manager, registry, session };
}

describe("KnowledgePolicyManager", () => {
  it("composes registry/session/statistics", () => {
    const { manager, registry, session } = buildManager();
    expect(manager.registry).toBe(registry);
    expect(manager.session).toBe(session);
    expect(manager.statistics).toBeTruthy();
  });

  it("register() records the execution, the registry entry, and statistics", () => {
    const { manager, registry } = buildManager();
    const execution = executionFixture();
    const entry = {
      id: execution.metadata.policyId,
      token: execution.instance.token,
      metadata: execution.metadata,
      configuration: execution.configuration,
    };
    manager.register(execution.instance.token, execution, entry);
    expect(manager.get(execution.instance.token)).toEqual(execution);
    expect(registry.get(KnowledgePolicyRegistryBucket.POLICY, execution.metadata.policyId)).toEqual(
      entry,
    );
    expect(manager.statistics.get(execution.metadata.policyType).createdCount).toBe(1);
  });

  it("get() returns undefined for an unknown token", () => {
    const { manager } = buildManager();
    expect(manager.get("missing")).toBeUndefined();
  });

  it("require() throws for an unknown token", () => {
    const { manager } = buildManager();
    expect(() => manager.require("missing")).toThrow("No execution registered for token");
  });

  it("require() returns the execution when registered", () => {
    const { manager } = buildManager();
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, {
      id: execution.metadata.policyId,
      token: execution.instance.token,
      metadata: execution.metadata,
      configuration: execution.configuration,
    });
    expect(manager.require(execution.instance.token)).toEqual(execution);
  });

  it("update() overwrites an existing execution", () => {
    const { manager } = buildManager();
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, {
      id: execution.metadata.policyId,
      token: execution.instance.token,
      metadata: execution.metadata,
      configuration: execution.configuration,
    });
    const updated = { ...execution, logs: [] };
    manager.update(execution.instance.token, updated);
    expect(manager.get(execution.instance.token)).toEqual(updated);
  });

  it("update() throws when the token isn't already registered", () => {
    const { manager } = buildManager();
    expect(() => manager.update("missing", executionFixture())).toThrow(
      "No execution registered for token",
    );
  });

  it("unregister() removes the execution and registry entry, returning true", () => {
    const { manager, registry } = buildManager();
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, {
      id: execution.metadata.policyId,
      token: execution.instance.token,
      metadata: execution.metadata,
      configuration: execution.configuration,
    });
    expect(manager.unregister(execution.instance.token)).toBe(true);
    expect(manager.get(execution.instance.token)).toBeUndefined();
    expect(
      registry.get(KnowledgePolicyRegistryBucket.POLICY, execution.metadata.policyId),
    ).toBeUndefined();
  });

  it("unregister() returns false for an unknown token", () => {
    const { manager } = buildManager();
    expect(manager.unregister("missing")).toBe(false);
  });

  it("list() returns all registered executions", () => {
    const { manager } = buildManager();
    const e1 = executionFixture();
    const e2 = executionFixture({
      instance: { ...executionFixture().instance, id: "instance-2", token: "kpol_2" },
      metadata: { ...executionFixture().metadata, policyId: "policy-2" },
    });
    manager.register(e1.instance.token, e1, {
      id: e1.metadata.policyId,
      token: e1.instance.token,
      metadata: e1.metadata,
      configuration: e1.configuration,
    });
    manager.register(e2.instance.token, e2, {
      id: e2.metadata.policyId,
      token: e2.instance.token,
      metadata: e2.metadata,
      configuration: e2.configuration,
    });
    expect(manager.list()).toHaveLength(2);
  });

  it("count() reflects the number of registered executions", () => {
    const { manager } = buildManager();
    expect(manager.count()).toBe(0);
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, {
      id: execution.metadata.policyId,
      token: execution.instance.token,
      metadata: execution.metadata,
      configuration: execution.configuration,
    });
    expect(manager.count()).toBe(1);
  });
});
