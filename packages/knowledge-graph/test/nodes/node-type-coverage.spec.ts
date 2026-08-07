import { describe, expect, it } from "vitest";

import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { KnowledgeNodeFactory } from "../../src/nodes/knowledge-node-factory.js";

const NON_CUSTOM_TYPES = Object.values(KnowledgeNodeType).filter(
  (type) => type !== KnowledgeNodeType.Custom,
);

describe("KnowledgeNodeFactory — every catalogued node type", () => {
  const factory = new KnowledgeNodeFactory();

  it.each(NON_CUSTOM_TYPES)("creates a %s node without requiring customTypeLabel", (type) => {
    const node = factory.create({ type, label: `a ${type}` });
    expect(node.type).toBe(type);
    expect(node.customTypeLabel).toBeUndefined();
    expect(node.label).toBe(`a ${type}`);
  });

  it("creates a Custom node only when customTypeLabel is supplied", () => {
    const node = factory.create({
      type: KnowledgeNodeType.Custom,
      customTypeLabel: "SpecialKind",
      label: "a custom node",
    });
    expect(node.type).toBe(KnowledgeNodeType.Custom);
    expect(node.customTypeLabel).toBe("SpecialKind");
  });

  it("every non-Custom type ignores a stray customTypeLabel (it is simply carried through)", () => {
    const node = factory.create({
      type: KnowledgeNodeType.Agent,
      customTypeLabel: "unused",
      label: "n",
    });
    expect(node.customTypeLabel).toBe("unused");
  });
});
