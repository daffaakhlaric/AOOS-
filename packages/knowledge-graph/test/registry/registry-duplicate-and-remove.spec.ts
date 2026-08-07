import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { DuplicateEntryException } from "../../src/errors/duplicate-entry-exception.js";
import { EdgeRegistry } from "../../src/registry/edge-registry.js";
import { NodeRegistry } from "../../src/registry/node-registry.js";
import { RelationshipRegistry } from "../../src/registry/relationship-registry.js";
import { SnapshotRegistry } from "../../src/registry/snapshot-registry.js";

const node = {
  id: "n1",
  type: KnowledgeNodeType.Knowledge,
  label: "n1",
  metadata: {},
  createdAt: 0,
  updatedAt: 0,
};

const edge = {
  id: "e1",
  type: KnowledgeEdgeType.RelatedTo,
  sourceNodeId: "n1",
  targetNodeId: "n2",
  weight: 1,
  metadata: {},
  createdAt: 0,
  updatedAt: 0,
};

describe("registries — remove-then-re-register round trip", () => {
  it("NodeRegistry allows re-registering after removal", () => {
    const registry = new NodeRegistry();
    registry.register("g1", node);
    registry.remove("n1");
    expect(() => registry.register("g1", node)).not.toThrow();
  });

  it("EdgeRegistry allows re-registering after removal", () => {
    const registry = new EdgeRegistry();
    registry.register("g1", edge);
    registry.remove("e1");
    expect(() => registry.register("g1", edge)).not.toThrow();
  });

  it("RelationshipRegistry allows re-registering after removal", () => {
    const registry = new RelationshipRegistry();
    const relationship = {
      edgeId: "e1",
      type: KnowledgeEdgeType.RelatedTo,
      sourceNodeId: "n1",
      targetNodeId: "n2",
      weight: 1,
    };
    registry.register(relationship);
    registry.remove("e1");
    expect(() => registry.register(relationship)).not.toThrow();
  });

  it("SnapshotRegistry allows re-registering after removal", () => {
    const registry = new SnapshotRegistry();
    const snapshot = { id: "s1", graphId: "g1", version: 1, nodes: [], edges: [], createdAt: 0 };
    registry.register(snapshot);
    registry.remove("s1");
    expect(() => registry.register(snapshot)).not.toThrow();
  });

  it("removing an id twice returns false the second time for every bucket", () => {
    const nodeRegistry = new NodeRegistry();
    nodeRegistry.register("g1", node);
    expect(nodeRegistry.remove("n1")).toBe(true);
    expect(nodeRegistry.remove("n1")).toBe(false);

    const edgeRegistry = new EdgeRegistry();
    edgeRegistry.register("g1", edge);
    expect(edgeRegistry.remove("e1")).toBe(true);
    expect(edgeRegistry.remove("e1")).toBe(false);
  });

  it("DuplicateEntryException is thrown by the same bucket name on repeated register()", () => {
    const registry = new NodeRegistry();
    registry.register("g1", node);
    try {
      registry.register("g1", node);
      throw new Error("expected DuplicateEntryException");
    } catch (error) {
      expect(error).toBeInstanceOf(DuplicateEntryException);
    }
  });
});
