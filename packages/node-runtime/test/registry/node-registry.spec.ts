import { describe, expect, it } from "vitest";
import { z } from "zod";

import { NodeCategory } from "../../src/contracts/node-category.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { NodeRegistryException } from "../../src/errors/node-registry-exception.js";
import { NodeRegistry } from "../../src/registry/node-registry.js";

describe("Registry Test — NodeRegistry", () => {
  it("registers every built-in + AI-native manifest by default", () => {
    const registry = new NodeRegistry();
    expect(registry.has(NodeType.START)).toBe(true);
    expect(registry.has(NodeType.AI_PLANNER)).toBe(true);
    expect(registry.has(NodeType.CAPABILITY)).toBe(true);
    expect(registry.list().length).toBe(Object.values(NodeType).length);
  });

  it("get() returns the full NodeManifest, undefined for an unregistered type", () => {
    const registry = new NodeRegistry([]);
    expect(registry.get(NodeType.START)).toBeUndefined();
  });

  it("getConfigSchema() returns the registered Zod schema, undefined when the manifest has none (e.g. Script)", () => {
    const registry = new NodeRegistry();
    expect(registry.getConfigSchema(NodeType.CAPABILITY)).toBeDefined();
    expect(registry.getConfigSchema(NodeType.SCRIPT)).toBeUndefined();
  });

  it("throws NodeRegistryException when constructed with a duplicate Node Type", () => {
    const manifest = {
      type: NodeType.START,
      category: NodeCategory.FLOW,
      name: "Start",
      version: "1.0.0",
      configSchema: z.object({}),
    };
    expect(() => new NodeRegistry([manifest, manifest])).toThrow(NodeRegistryException);
  });

  it("accepts a caller-supplied manifest list (e.g. for a custom Node Type registration)", () => {
    const custom = {
      type: NodeType.CUSTOM,
      category: NodeCategory.FLOW,
      name: "Custom",
      version: "1.0.0",
    };
    const registry = new NodeRegistry([custom]);
    expect(registry.list()).toEqual([custom]);
  });
});
