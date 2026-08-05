import { describe, expect, it } from "vitest";

import { NodeCategory } from "../../src/contracts/node-category.js";
import { NODE_TYPE_CATEGORY, NodeType } from "../../src/contracts/node-type.js";

describe("NodeType / NODE_TYPE_CATEGORY", () => {
  it("maps every NodeType to a NodeCategory", () => {
    for (const type of Object.values(NodeType)) {
      expect(NODE_TYPE_CATEGORY[type]).toBeDefined();
    }
  });

  it("classifies the 8 AI-native reasoning types under AI_NATIVE", () => {
    const aiNativeTypes = [
      NodeType.AI_PLANNER,
      NodeType.AI_REASON,
      NodeType.AI_REFLECTION,
      NodeType.AI_CRITIC,
      NodeType.AI_DEBATE,
      NodeType.AI_VOTING,
      NodeType.AI_CONSENSUS,
      NodeType.AI_SIMULATION,
    ];
    for (const type of aiNativeTypes) {
      expect(NODE_TYPE_CATEGORY[type]).toBe(NodeCategory.AI_NATIVE);
    }
  });

  it("classifies Capability, Knowledge Search, and Human Approval under their own category", () => {
    expect(NODE_TYPE_CATEGORY[NodeType.CAPABILITY]).toBe(NodeCategory.CAPABILITY);
    expect(NODE_TYPE_CATEGORY[NodeType.KNOWLEDGE_SEARCH]).toBe(NodeCategory.KNOWLEDGE);
    expect(NODE_TYPE_CATEGORY[NodeType.HUMAN_APPROVAL]).toBe(NodeCategory.HUMAN);
  });
});
