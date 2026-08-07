import { describe, expect, it } from "vitest";

import { DuplicateEntryException } from "../../src/errors/duplicate-entry-exception.js";
import { GraphConfigurationException } from "../../src/errors/graph-configuration-exception.js";
import { SnapshotNotFoundException } from "../../src/errors/snapshot-not-found-exception.js";
import { PermissiveAuthorizationChecker } from "../../src/infrastructure/permissive-authorization-checker.js";
import {
  ConfigurationRegistry,
  DEFAULT_CONFIGURATION_KEY,
} from "../../src/registry/configuration-registry.js";
import { SnapshotRegistry } from "../../src/registry/snapshot-registry.js";

const snapshot = {
  id: "s1",
  graphId: "g1",
  version: 1,
  nodes: [],
  edges: [],
  createdAt: 100,
};

describe("SnapshotRegistry", () => {
  it("registers/gets/removes snapshots by id", () => {
    const registry = new SnapshotRegistry();
    registry.register(snapshot);
    expect(registry.get("s1")).toEqual(snapshot);
    expect(registry.tryGet("s1")).toEqual(snapshot);
    expect(registry.has("s1")).toBe(true);
    expect(registry.list()).toEqual([snapshot]);
    expect(registry.size).toBe(1);
    expect(registry.remove("s1")).toBe(true);
    registry.clear();
  });

  it("throws SnapshotNotFoundException for a missing snapshot", () => {
    const registry = new SnapshotRegistry();
    expect(() => registry.get("missing")).toThrow(SnapshotNotFoundException);
  });

  it("throws DuplicateEntryException on id collision via register", () => {
    const registry = new SnapshotRegistry();
    registry.register(snapshot);
    expect(() => registry.register(snapshot)).toThrow(DuplicateEntryException);
  });

  it("listForGraph filters by graphId and sorts newest first", () => {
    const registry = new SnapshotRegistry();
    registry.register({ ...snapshot, id: "s1", createdAt: 100 });
    registry.register({ ...snapshot, id: "s2", createdAt: 200 });
    registry.register({ ...snapshot, id: "s3", graphId: "other-graph", createdAt: 300 });
    const forGraph = registry.listForGraph("g1");
    expect(forGraph.map((s) => s.id)).toEqual(["s2", "s1"]);
  });
});

describe("ConfigurationRegistry", () => {
  it("put/get/has/remove/list round-trip", () => {
    const registry = new ConfigurationRegistry();
    const resolved = {
      authorizationChecker: new PermissiveAuthorizationChecker(),
      cycleCheckedEdgeTypes: new Set(),
      strictRelationshipValidation: true,
    };
    registry.put("g1", resolved);
    expect(registry.get("g1")).toBe(resolved);
    expect(registry.tryGet("g1")).toBe(resolved);
    expect(registry.has("g1")).toBe(true);
    expect(registry.list()).toEqual([resolved]);
    expect(registry.size).toBe(1);
    expect(registry.remove("g1")).toBe(true);
    registry.put("g2", resolved);
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it("throws GraphConfigurationException for a missing key", () => {
    const registry = new ConfigurationRegistry();
    expect(() => registry.get("missing")).toThrow(GraphConfigurationException);
  });

  it("resolveFor falls back to the system-wide default", () => {
    const registry = new ConfigurationRegistry();
    const defaultConfig = {
      authorizationChecker: new PermissiveAuthorizationChecker(),
      cycleCheckedEdgeTypes: new Set(),
      strictRelationshipValidation: true,
    };
    registry.put(DEFAULT_CONFIGURATION_KEY, defaultConfig);
    expect(registry.resolveFor("no-specific-config-graph")).toBe(defaultConfig);
  });

  it("resolveFor prefers a graph-specific configuration when present", () => {
    const registry = new ConfigurationRegistry();
    const defaultConfig = {
      authorizationChecker: new PermissiveAuthorizationChecker(),
      cycleCheckedEdgeTypes: new Set(),
      strictRelationshipValidation: true,
    };
    const graphConfig = { ...defaultConfig, strictRelationshipValidation: false };
    registry.put(DEFAULT_CONFIGURATION_KEY, defaultConfig);
    registry.put("g1", graphConfig);
    expect(registry.resolveFor("g1")).toBe(graphConfig);
  });
});
