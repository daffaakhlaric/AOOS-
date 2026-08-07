import { describe, expect, it } from "vitest";

import { ConfigurationRegistry } from "../../src/registry/configuration-registry.js";
import { EdgeRegistry } from "../../src/registry/edge-registry.js";
import { GraphRegistry } from "../../src/registry/graph-registry.js";
import { NodeRegistry } from "../../src/registry/node-registry.js";
import { RelationshipRegistry } from "../../src/registry/relationship-registry.js";
import { SnapshotRegistry } from "../../src/registry/snapshot-registry.js";

describe("registries — initial empty state", () => {
  it("GraphRegistry starts empty", () => {
    const registry = new GraphRegistry();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
    expect(registry.has("x")).toBe(false);
    expect(registry.remove("x")).toBe(false);
  });

  it("NodeRegistry starts empty", () => {
    const registry = new NodeRegistry();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it("EdgeRegistry starts empty", () => {
    const registry = new EdgeRegistry();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it("RelationshipRegistry starts empty", () => {
    const registry = new RelationshipRegistry();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it("SnapshotRegistry starts empty", () => {
    const registry = new SnapshotRegistry();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
    expect(registry.listForGraph("any")).toEqual([]);
  });

  it("ConfigurationRegistry starts empty", () => {
    const registry = new ConfigurationRegistry();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
    expect(registry.has("any")).toBe(false);
  });
});
