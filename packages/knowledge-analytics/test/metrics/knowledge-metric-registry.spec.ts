import { describe, expect, it } from "vitest";

import { MetricNotFoundException } from "../../src/errors/metric-not-found-exception.js";
import { KnowledgeMetricRegistry } from "../../src/metrics/knowledge-metric-registry.js";
import { KnowledgeMetricUnit } from "../../src/types/common.js";
import { KnowledgeMetricCategory } from "../../src/types/metric-category.js";
import { KnowledgeMetricDefinition } from "../../src/value-objects/knowledge-metric-definition.js";

function definition(id: string): KnowledgeMetricDefinition {
  return new KnowledgeMetricDefinition({
    id,
    name: id,
    category: KnowledgeMetricCategory.Usage,
    unit: KnowledgeMetricUnit.Count,
    description: "test metric",
  });
}

describe("KnowledgeMetricRegistry", () => {
  it("registers a metric with an initial value of 0", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("x"));
    expect(registry.get("x").currentValue).toBe(0);
  });

  it("reports isRegistered correctly", () => {
    const registry = new KnowledgeMetricRegistry();
    expect(registry.isRegistered("x")).toBe(false);
    registry.register(definition("x"));
    expect(registry.isRegistered("x")).toBe(true);
  });

  it("updates a registered metric's value and updatedAt", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("x"));
    registry.updateValue("x", 42, 1000);
    expect(registry.get("x").currentValue).toBe(42);
    expect(registry.get("x").updatedAt).toBe(1000);
  });

  it("throws MetricNotFoundException when updating an unregistered metric", () => {
    const registry = new KnowledgeMetricRegistry();
    expect(() => registry.updateValue("missing", 1, 0)).toThrow(MetricNotFoundException);
  });

  it("throws MetricNotFoundException from get() for an unregistered metric", () => {
    const registry = new KnowledgeMetricRegistry();
    expect(() => registry.get("missing")).toThrow(MetricNotFoundException);
  });

  it("tryGet returns undefined for an unregistered metric", () => {
    const registry = new KnowledgeMetricRegistry();
    expect(registry.tryGet("missing")).toBeUndefined();
  });

  it("tryGet returns the entry for a registered metric", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("x"));
    expect(registry.tryGet("x")).toBeDefined();
  });

  it("unregisters a metric and returns true", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("x"));
    expect(registry.unregister("x")).toBe(true);
    expect(registry.isRegistered("x")).toBe(false);
  });

  it("unregister returns false for an unknown id", () => {
    const registry = new KnowledgeMetricRegistry();
    expect(registry.unregister("missing")).toBe(false);
  });

  it("lists every registered entry", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("a"));
    registry.register(definition("b"));
    expect(registry.list()).toHaveLength(2);
  });

  it("reports size", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("a"));
    registry.register(definition("b"));
    expect(registry.size()).toBe(2);
  });

  it("clears every entry", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("a"));
    registry.clear();
    expect(registry.size()).toBe(0);
  });

  it("preserves the definition across an updateValue call", () => {
    const registry = new KnowledgeMetricRegistry();
    const def = definition("x");
    registry.register(def);
    registry.updateValue("x", 5, 1);
    expect(registry.get("x").definition).toBe(def);
  });
});
