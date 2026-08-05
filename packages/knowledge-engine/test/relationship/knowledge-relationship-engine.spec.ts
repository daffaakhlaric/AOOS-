import { describe, expect, it } from "vitest";

import { KnowledgeRelationshipType } from "../../src/domain/knowledge-relationship-type.js";
import { InvalidRelationshipException } from "../../src/errors/invalid-relationship-exception.js";
import { RelationshipFactory } from "../../src/factory/relationship-factory.js";
import { KnowledgeRegistry } from "../../src/registry/knowledge-registry.js";
import { KnowledgeRelationshipEngine } from "../../src/relationship/knowledge-relationship-engine.js";

const factory = new RelationshipFactory();

describe("Relationship Test — KnowledgeRelationshipEngine", () => {
  it("add() registers the Relationship and its structural inverse", () => {
    const engine = new KnowledgeRelationshipEngine(new KnowledgeRegistry());
    const relationship = factory.create({
      fromAssetId: "a-1",
      toAssetId: "a-2",
      type: KnowledgeRelationshipType.PARENT,
    });
    engine.add(relationship);
    expect(engine.list()).toHaveLength(2);
    const inverse = engine.list().find((entry) => entry.id !== relationship.id);
    expect(inverse?.type).toBe(KnowledgeRelationshipType.CHILD);
    expect(inverse?.fromAssetId).toBe("a-2");
    expect(inverse?.toAssetId).toBe("a-1");
  });

  it("add() throws InvalidRelationshipException for a self-referencing edge", () => {
    const engine = new KnowledgeRelationshipEngine(new KnowledgeRegistry());
    expect(() =>
      engine.add({
        id: "r-1",
        fromAssetId: "a-1",
        toAssetId: "a-1",
        type: KnowledgeRelationshipType.RELATED,
        createdAt: new Date().toISOString(),
      }),
    ).toThrow(InvalidRelationshipException);
  });

  it("outgoing()/incoming() reflect the indexed edges", () => {
    const engine = new KnowledgeRelationshipEngine(new KnowledgeRegistry());
    const relationship = factory.create({
      fromAssetId: "a-1",
      toAssetId: "a-2",
      type: KnowledgeRelationshipType.USES,
    });
    engine.add(relationship);
    expect(engine.outgoing("a-1")).toHaveLength(1);
    expect(engine.incoming("a-2")).toHaveLength(1);
    expect(engine.incoming("a-1")).toHaveLength(1); // the auto-registered inverse (CONSUMED_BY a-2 -> a-1)
  });

  it("neighbors() combines outgoing and incoming edges", () => {
    const engine = new KnowledgeRelationshipEngine(new KnowledgeRegistry());
    engine.add(
      factory.create({
        fromAssetId: "a-1",
        toAssetId: "a-2",
        type: KnowledgeRelationshipType.RELATED,
      }),
    );
    engine.add(
      factory.create({
        fromAssetId: "a-3",
        toAssetId: "a-1",
        type: KnowledgeRelationshipType.RELATED,
      }),
    );
    expect(engine.neighbors("a-1").length).toBeGreaterThanOrEqual(2);
  });

  it("remove() deletes a Relationship and un-indexes it (but not its inverse)", () => {
    const engine = new KnowledgeRelationshipEngine(new KnowledgeRegistry());
    const relationship = factory.create({
      fromAssetId: "a-1",
      toAssetId: "a-2",
      type: KnowledgeRelationshipType.RELATED,
    });
    engine.add(relationship);
    expect(engine.remove(relationship.id)).toBe(true);
    expect(engine.outgoing("a-1")).toHaveLength(0);
    expect(engine.list()).toHaveLength(1); // inverse still present
  });

  it("remove() returns false when nothing matches", () => {
    const engine = new KnowledgeRelationshipEngine(new KnowledgeRegistry());
    expect(engine.remove("missing")).toBe(false);
  });

  it("outgoing()/incoming() return an empty array for an unknown Asset id", () => {
    const engine = new KnowledgeRelationshipEngine(new KnowledgeRegistry());
    expect(engine.outgoing("ghost")).toEqual([]);
    expect(engine.incoming("ghost")).toEqual([]);
  });
});
