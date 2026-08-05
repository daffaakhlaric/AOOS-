import { describe, expect, it } from "vitest";

import { RegistryKindGraph } from "../../src/bootstrap/registry-kind-graph.js";
import { RegistrySystem } from "../../src/bootstrap/registry-system.js";

describe("Dependency Test — RegistryKindGraph.validateKindGraph (005.3A Enhancement 6)", () => {
  it("the canonical Agent → Capability → Tool → Connector chain has no cycles or missing kinds", () => {
    const graph = new RegistryKindGraph();
    const result = graph.validateKindGraph();
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.circular).toEqual([]);
  });

  it("produces a valid topological load order that respects the declared chain", () => {
    const graph = new RegistryKindGraph();
    const result = graph.validateKindGraph();
    const indexOf = (kind: string): number => result.loadOrder.indexOf(kind);
    // Capability must load before Agent (Agent depends on Capability), Connector before Tool.
    expect(indexOf("capability")).toBeLessThan(indexOf("agent"));
    expect(indexOf("connector")).toBeLessThan(indexOf("tool"));
  });
});

describe("Dependency Test — RegistryKindGraph.audit (Duplicate ID + Invalid Version)", () => {
  it("reports ok:true with no duplicates/invalid versions on a clean system", async () => {
    const system = new RegistrySystem();
    await system.tool.register({
      id: "kie",
      version: "1.0.0",
      category: "media",
      provider: "kie.ai",
      side_effect_class: "reversible_write",
    });
    const graph = new RegistryKindGraph();
    const result = graph.audit(system);
    expect(result.ok).toBe(true);
    expect(result.duplicateIds).toEqual([]);
    expect(result.invalidVersionReferences).toEqual([]);
  });

  it("Duplicate ID: flags the same id registered under two different Registry kinds", async () => {
    const system = new RegistrySystem();
    await system.tool.register({
      id: "shared-id",
      version: "1.0.0",
      category: "media",
      provider: "kie.ai",
      side_effect_class: "reversible_write",
    });
    await system.workflow.register({ id: "shared-id", version: "1.0.0", category: "marketing" });

    const result = new RegistryKindGraph().audit(system);
    expect(result.ok).toBe(false);
    expect(result.duplicateIds).toHaveLength(1);
    expect(result.duplicateIds[0]?.id).toBe("shared-id");
    expect(result.duplicateIds[0]?.kinds.sort()).toEqual(["tool", "workflow"]);
  });

  it("Invalid Version: flags an id@range cross-reference whose target version doesn't satisfy the range", async () => {
    const system = new RegistrySystem();
    await system.tool.register({
      id: "kie",
      version: "1.0.0",
      category: "media",
      provider: "kie.ai",
      side_effect_class: "reversible_write",
    });
    await system.agent.register({
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
      required_tools: ["kie@^2.0.0"],
    });

    const result = new RegistryKindGraph().audit(system);
    expect(result.ok).toBe(false);
    expect(result.invalidVersionReferences).toHaveLength(1);
    expect(result.invalidVersionReferences[0]?.reference).toBe("kie@^2.0.0");
  });

  it("Invalid Version: flags an id@range pin whose target id doesn't exist", async () => {
    const system = new RegistrySystem();
    await system.agent.register({
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
      required_tools: ["ghost@^1.0.0"],
    });

    const result = new RegistryKindGraph().audit(system);
    expect(result.invalidVersionReferences[0]?.reason).toContain("not found");
  });

  it("Invalid Version: flags a malformed version range as invalid", async () => {
    const system = new RegistrySystem();
    await system.tool.register({
      id: "kie",
      version: "1.0.0",
      category: "media",
      provider: "kie.ai",
      side_effect_class: "reversible_write",
    });
    await system.agent.register({
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
      required_tools: ["kie@not-a-range"],
    });

    const result = new RegistryKindGraph().audit(system);
    expect(result.invalidVersionReferences).toHaveLength(1);
    expect(result.invalidVersionReferences[0]?.reason.toLowerCase()).toContain("valid semver");
  });

  it("a plain id (no @) is never treated as a version pin", async () => {
    const system = new RegistrySystem();
    await system.tool.register({
      id: "kie",
      version: "1.0.0",
      category: "media",
      provider: "kie.ai",
      side_effect_class: "reversible_write",
    });
    await system.agent.register({
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
      required_tools: ["kie"],
    });

    const result = new RegistryKindGraph().audit(system);
    expect(result.invalidVersionReferences).toEqual([]);
  });
});
