import { describe, expect, it } from "vitest";

import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { GraphFactory } from "../../src/factory/graph-factory.js";
import { GraphSnapshotFactory } from "../../src/factory/graph-snapshot-factory.js";
import { addNode, buildDagEngine } from "../helpers/graph-fixtures.js";

describe("GraphFactory", () => {
  it("creates a fresh, empty GraphEngine", () => {
    const factory = new GraphFactory();
    const engine = factory.create({ name: "New Graph" });
    expect(engine.graph.name).toBe("New Graph");
    expect(engine.listNodes()).toHaveLength(0);
  });
});

describe("GraphSnapshotFactory", () => {
  it("deep-clones the current nodes/edges into an immutable snapshot", () => {
    const engine = buildDagEngine();
    const factory = new GraphSnapshotFactory();
    const snapshot = factory.create(engine, "checkpoint-1");

    expect(snapshot.graphId).toBe(engine.graph.id);
    expect(snapshot.version).toBe(engine.graph.version);
    expect(snapshot.label).toBe("checkpoint-1");
    expect(snapshot.nodes).toHaveLength(4);
    expect(snapshot.edges).toHaveLength(4);
    expect(typeof snapshot.createdAt).toBe("number");
  });

  it("the snapshot is independent of later mutation to the live graph", () => {
    const engine = buildDagEngine();
    const factory = new GraphSnapshotFactory();
    const snapshot = factory.create(engine);
    addNode(engine, "E", KnowledgeNodeType.Knowledge);
    expect(snapshot.nodes).toHaveLength(4);
  });

  it("label is optional", () => {
    const engine = buildDagEngine();
    const factory = new GraphSnapshotFactory();
    const snapshot = factory.create(engine);
    expect(snapshot.label).toBeUndefined();
  });
});
