import { beforeEach, describe, expect, it } from "vitest";

import { MarketplaceNotFoundException } from "../../src/errors/marketplace-not-found-exception.js";
import { KnowledgeMarketplaceManager } from "../../src/manager/knowledge-marketplace-manager.js";
import { KnowledgeMarketplaceRegistry } from "../../src/registry/knowledge-marketplace-registry.js";
import type { MarketplaceRegistryEntry } from "../../src/registry/marketplace-registry-entry.js";
import { KnowledgeMarketplaceSession } from "../../src/session/knowledge-marketplace-session.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeMarketplaceManager", () => {
  let manager: KnowledgeMarketplaceManager;

  beforeEach(() => {
    manager = new KnowledgeMarketplaceManager(
      new KnowledgeMarketplaceRegistry(),
      new KnowledgeMarketplaceSession(),
    );
  });

  function entryFor(execution: ReturnType<typeof executionFixture>): MarketplaceRegistryEntry {
    return {
      id: execution.metadata.listingId,
      token: execution.instance.token,
      metadata: execution.metadata,
    };
  }

  it("registers and retrieves an execution by token", () => {
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, entryFor(execution));
    expect(manager.get(execution.instance.token)).toBe(execution);
  });

  it("get returns undefined for an unknown token", () => {
    expect(manager.get("missing")).toBeUndefined();
  });

  it("require returns the execution for a known token", () => {
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, entryFor(execution));
    expect(manager.require(execution.instance.token)).toBe(execution);
  });

  it("require throws MarketplaceNotFoundException for an unknown token", () => {
    expect(() => manager.require("missing")).toThrow(MarketplaceNotFoundException);
  });

  it("update replaces the execution for a registered token", () => {
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, entryFor(execution));
    const updated = {
      ...execution,
      logs: [
        {
          sequence: 0,
          level: "info",
          operation: "x",
          message: "y",
          occurredAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    manager.update(execution.instance.token, updated);
    expect(manager.get(execution.instance.token)).toBe(updated);
  });

  it("update throws MarketplaceNotFoundException for an unregistered token", () => {
    expect(() => manager.update("missing", executionFixture())).toThrow(
      MarketplaceNotFoundException,
    );
  });

  it("unregister removes a registered execution and returns true", () => {
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, entryFor(execution));
    expect(manager.unregister(execution.instance.token)).toBe(true);
    expect(manager.get(execution.instance.token)).toBeUndefined();
  });

  it("unregister returns false for an unknown token", () => {
    expect(manager.unregister("missing")).toBe(false);
  });

  it("list returns every registered execution", () => {
    const aMetadata = { ...executionFixture().metadata, listingId: "listing-a" };
    const bMetadata = { ...executionFixture().metadata, listingId: "listing-b" };
    const a = executionFixture({
      metadata: aMetadata,
      instance: { ...executionFixture().instance, token: "kmkt_a", listingId: "listing-a" },
    });
    const b = executionFixture({
      metadata: bMetadata,
      instance: { ...executionFixture().instance, token: "kmkt_b", listingId: "listing-b" },
    });
    manager.register("kmkt_a", a, entryFor(a));
    manager.register("kmkt_b", b, entryFor(b));
    expect(manager.list()).toHaveLength(2);
  });

  it("count reflects the number of registered executions", () => {
    expect(manager.count()).toBe(0);
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, entryFor(execution));
    expect(manager.count()).toBe(1);
  });

  it("exposes the underlying registry and session", () => {
    expect(manager.registry).toBeDefined();
    expect(manager.session).toBeDefined();
  });

  it("register updates category statistics", () => {
    const execution = executionFixture();
    manager.register(execution.instance.token, execution, entryFor(execution));
    expect(manager.statistics.get(execution.metadata.category).listedCount).toBe(1);
  });
});
