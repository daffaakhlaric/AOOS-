import { describe, expect, it } from "vitest";

import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { GraphValidationException } from "../../src/errors/graph-validation-exception.js";
import { KnowledgeNodeFactory } from "../../src/nodes/knowledge-node-factory.js";

describe("KnowledgeNodeFactory", () => {
  const factory = new KnowledgeNodeFactory();

  it("creates a node with a generated id/timestamps and default metadata", () => {
    const node = factory.create({ type: KnowledgeNodeType.Agent, label: "My Agent" });
    expect(node.id).toBeTruthy();
    expect(node.type).toBe(KnowledgeNodeType.Agent);
    expect(node.label).toBe("My Agent");
    expect(node.metadata).toEqual({});
    expect(node.createdAt).toBe(node.updatedAt);
  });

  it("honors a caller-supplied id and metadata", () => {
    const node = factory.create({
      id: "n1",
      type: KnowledgeNodeType.Tool,
      label: "T",
      metadata: { key: "value" },
    });
    expect(node.id).toBe("n1");
    expect(node.metadata).toEqual({ key: "value" });
  });

  it("rejects an empty label", () => {
    expect(() => factory.create({ type: KnowledgeNodeType.Tool, label: "" })).toThrow(
      GraphValidationException,
    );
  });

  it("rejects a whitespace-only label", () => {
    expect(() => factory.create({ type: KnowledgeNodeType.Tool, label: "   " })).toThrow(
      GraphValidationException,
    );
  });

  it("requires customTypeLabel when type is Custom", () => {
    expect(() => factory.create({ type: KnowledgeNodeType.Custom, label: "x" })).toThrow(
      GraphValidationException,
    );
  });

  it("accepts Custom type with a customTypeLabel", () => {
    const node = factory.create({
      type: KnowledgeNodeType.Custom,
      customTypeLabel: "SpecialThing",
      label: "x",
    });
    expect(node.customTypeLabel).toBe("SpecialThing");
  });
});
