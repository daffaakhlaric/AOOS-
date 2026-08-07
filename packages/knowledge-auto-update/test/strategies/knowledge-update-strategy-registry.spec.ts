import { describe, expect, it } from "vitest";

import { StrategyNotFoundException } from "../../src/errors/strategy-not-found-exception.js";
import { KnowledgeUpdateStrategyRegistry } from "../../src/strategies/knowledge-update-strategy-registry.js";
import { ALL_UPDATE_TYPES } from "../../src/types/update-type.js";

describe("KnowledgeUpdateStrategyRegistry", () => {
  it("resolves a strategy for every one of the 13 update types by default", () => {
    const registry = new KnowledgeUpdateStrategyRegistry();
    for (const type of ALL_UPDATE_TYPES) {
      expect(registry.resolve(type).updateType).toBe(type);
    }
  });

  it("defaults() returns exactly 13 strategies", () => {
    expect(KnowledgeUpdateStrategyRegistry.defaults()).toHaveLength(13);
  });

  it("throws StrategyNotFoundException when a type has no registered strategy", () => {
    const registry = new KnowledgeUpdateStrategyRegistry([]);
    expect(() => registry.resolve(ALL_UPDATE_TYPES[0]!)).toThrow(StrategyNotFoundException);
  });

  it("resolving an unregistered type is safe to attempt multiple times", () => {
    const registry = new KnowledgeUpdateStrategyRegistry([]);
    expect(() => registry.resolve(ALL_UPDATE_TYPES[1]!)).toThrow(StrategyNotFoundException);
    expect(() => registry.resolve(ALL_UPDATE_TYPES[1]!)).toThrow(StrategyNotFoundException);
  });

  it("accepts a custom strategy list overriding defaults", () => {
    const custom = KnowledgeUpdateStrategyRegistry.defaults().slice(0, 1);
    const registry = new KnowledgeUpdateStrategyRegistry(custom);
    expect(registry.resolve(custom[0]!.updateType)).toBe(custom[0]);
  });
});
