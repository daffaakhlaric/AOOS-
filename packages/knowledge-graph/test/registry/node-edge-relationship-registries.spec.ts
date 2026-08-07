import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { DuplicateEntryException } from "../../src/errors/duplicate-entry-exception.js";
import { EdgeNotFoundException } from "../../src/errors/edge-not-found-exception.js";
import { NodeNotFoundException } from "../../src/errors/node-not-found-exception.js";
import { EdgeRegistry } from "../../src/registry/edge-registry.js";
import { NodeRegistry } from "../../src/registry/node-registry.js";
import { RelationshipRegistry } from "../../src/registry/relationship-registry.js";

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

describe("NodeRegistry", () => {
  it("registers/gets/puts/removes entries keyed by node id, carrying graphId", () => {
    const registry = new NodeRegistry();
    registry.register("g1", node);
    expect(registry.get("n1")).toEqual({ graphId: "g1", node });
    expect(registry.tryGet("n1")).toEqual({ graphId: "g1", node });
    expect(registry.has("n1")).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(registry.size).toBe(1);
    registry.put("g2", node);
    expect(registry.get("n1").graphId).toBe("g2");
    expect(registry.remove("n1")).toBe(true);
    registry.clear();
  });

  it("throws NodeNotFoundException for a missing node", () => {
    const registry = new NodeRegistry();
    expect(() => registry.get("missing")).toThrow(NodeNotFoundException);
    expect(registry.tryGet("missing")).toBeUndefined();
  });

  it("throws DuplicateEntryException on id collision via register", () => {
    const registry = new NodeRegistry();
    registry.register("g1", node);
    expect(() => registry.register("g1", node)).toThrow(DuplicateEntryException);
  });
});

describe("EdgeRegistry", () => {
  it("registers/gets/puts/removes entries keyed by edge id, carrying graphId", () => {
    const registry = new EdgeRegistry();
    registry.register("g1", edge);
    expect(registry.get("e1")).toEqual({ graphId: "g1", edge });
    expect(registry.tryGet("e1")).toEqual({ graphId: "g1", edge });
    expect(registry.has("e1")).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(registry.size).toBe(1);
    registry.put("g2", edge);
    expect(registry.get("e1").graphId).toBe("g2");
    expect(registry.remove("e1")).toBe(true);
    registry.clear();
  });

  it("throws EdgeNotFoundException for a missing edge", () => {
    const registry = new EdgeRegistry();
    expect(() => registry.get("missing")).toThrow(EdgeNotFoundException);
  });

  it("throws DuplicateEntryException on id collision via register", () => {
    const registry = new EdgeRegistry();
    registry.register("g1", edge);
    expect(() => registry.register("g1", edge)).toThrow(DuplicateEntryException);
  });
});

describe("RelationshipRegistry", () => {
  const relationship = {
    edgeId: "e1",
    type: KnowledgeEdgeType.RelatedTo,
    sourceNodeId: "n1",
    targetNodeId: "n2",
    weight: 1,
  };

  it("registers/gets/puts/removes entries keyed by edgeId", () => {
    const registry = new RelationshipRegistry();
    registry.register(relationship);
    expect(registry.get("e1")).toEqual(relationship);
    expect(registry.tryGet("e1")).toEqual(relationship);
    expect(registry.has("e1")).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(registry.size).toBe(1);
    registry.put({ ...relationship, weight: 2 });
    expect(registry.get("e1").weight).toBe(2);
    expect(registry.remove("e1")).toBe(true);
    registry.clear();
  });

  it("throws EdgeNotFoundException for a missing relationship", () => {
    const registry = new RelationshipRegistry();
    expect(() => registry.get("missing")).toThrow(EdgeNotFoundException);
  });

  it("throws DuplicateEntryException on id collision via register", () => {
    const registry = new RelationshipRegistry();
    registry.register(relationship);
    expect(() => registry.register(relationship)).toThrow(DuplicateEntryException);
  });
});
