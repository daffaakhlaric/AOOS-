import { describe, expect, it } from "vitest";

import { RegistrySystem } from "../../src/bootstrap/registry-system.js";
import { RegistryKind } from "../../src/contracts/registry-kind.js";
import { DependencyException } from "../../src/errors/index.js";

async function seedDependencies(system: RegistrySystem): Promise<void> {
  await system.tool.register({
    id: "kie",
    version: "1.0.0",
    category: "media",
    provider: "kie.ai",
    side_effect_class: "reversible_write",
  });
  await system.tool.register({
    id: "postiz",
    version: "1.0.0",
    category: "social",
    provider: "postiz",
    side_effect_class: "reversible_write",
  });
  await system.model.register({
    id: "gpt-5.5",
    version: "1.0.0",
    category: "chat",
    provider: "openai",
    cost_tier: "balanced",
  });
  await system.memoryProvider.register({
    id: "campaign_memory",
    version: "1.0.0",
    category: "marketing",
    tier: "episodic",
  });
  await system.workflow.register({
    id: "campaign_creation",
    version: "1.0.0",
    category: "marketing",
  });
}

const CONTENT_MANAGER_MANIFEST = {
  id: "content-manager",
  version: "1.0.0",
  category: "marketing",
  capabilities: ["content_generation", "image_generation"],
  required_tools: ["kie", "postiz"],
  required_models: ["gpt-5.5"],
  permissions: ["social.publish"],
  memory: ["campaign_memory"],
  workflows: ["campaign_creation"],
};

describe("RegistrySystem — aggregation", () => {
  it("exposes all 27 Registries (23 original + 4 from 005.3A) via get(kind) and list()", () => {
    const system = new RegistrySystem();
    expect(system.list()).toHaveLength(27);
    expect(system.get(RegistryKind.AGENT)).toBe(system.agent);
    expect(system.get(RegistryKind.TOOL)).toBe(system.tool);
    expect(system.get(RegistryKind.INDUSTRY)).toBe(system.industry);
    expect(system.get(RegistryKind.SOLUTION_PACK)).toBe(system.solutionPack);
    expect(system.get(RegistryKind.MODEL_PROFILE)).toBe(system.modelProfile);
    expect(system.get(RegistryKind.AGENT_BLUEPRINT)).toBe(system.agentBlueprint);
  });

  it("totalEntryCount sums entries across every Registry", async () => {
    const system = new RegistrySystem();
    await system.tool.register({
      id: "a",
      version: "1.0.0",
      category: "x",
      provider: "p",
      side_effect_class: "read_only",
    });
    await system.model.register({
      id: "b",
      version: "1.0.0",
      category: "x",
      provider: "p",
      cost_tier: "balanced",
    });
    expect(system.totalEntryCount).toBe(2);
  });
});

describe("RegistrySystem — cross-reference validation (the user's revised manifest concept)", () => {
  it("validateCrossReferences passes when every referenced id exists", async () => {
    const system = new RegistrySystem();
    await seedDependencies(system);
    const result = system.validateCrossReferences(RegistryKind.AGENT, CONTENT_MANAGER_MANIFEST);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("validateCrossReferences reports every missing reference, grouped by field", async () => {
    const system = new RegistrySystem();
    // Deliberately do not seed any dependency.
    const result = system.validateCrossReferences(RegistryKind.AGENT, CONTENT_MANAGER_MANIFEST);
    expect(result.valid).toBe(false);
    const byField = Object.fromEntries(
      result.issues.map((issue) => [issue.field, issue.missingIds]),
    );
    expect(byField.required_tools).toEqual(["kie", "postiz"]);
    expect(byField.required_models).toEqual(["gpt-5.5"]);
    expect(byField.memory).toEqual(["campaign_memory"]);
    expect(byField.workflows).toEqual(["campaign_creation"]);
    expect(byField.permissions).toBeUndefined(); // permissions are intentionally not cross-referenced
  });

  it("registerWithCrossCheck succeeds end-to-end once dependencies are registered", async () => {
    const system = new RegistrySystem();
    await seedDependencies(system);
    await system.registerWithCrossCheck(RegistryKind.AGENT, CONTENT_MANAGER_MANIFEST);
    expect(system.agent.has("content-manager")).toBe(true);
  });

  it("registerWithCrossCheck throws DependencyException and does NOT register when a reference is missing", async () => {
    const system = new RegistrySystem();
    await expect(
      system.registerWithCrossCheck(RegistryKind.AGENT, CONTENT_MANAGER_MANIFEST),
    ).rejects.toThrow(DependencyException);
    expect(system.agent.has("content-manager")).toBe(false);
  });

  it("a Registry kind with no declared cross-reference fields (e.g. Tool) always passes", () => {
    const system = new RegistrySystem();
    const result = system.validateCrossReferences(RegistryKind.TOOL, {
      id: "kie",
      version: "1.0.0",
      category: "media",
    });
    expect(result.valid).toBe(true);
  });
});

describe("RegistrySystem — IModule lifecycle (Kernel integration point)", () => {
  it("onBootstrap resolves without throwing", async () => {
    const system = new RegistrySystem();
    await expect(system.onBootstrap?.({} as never)).resolves.toBeUndefined();
  });

  it("onShutdown clears all event listeners", async () => {
    const system = new RegistrySystem();
    system.events.on("registry.loaded" as never, () => undefined);
    await system.onShutdown?.({} as never);
    expect(system.events.listenerCount("registry.loaded" as never)).toBe(0);
  });
});

describe("RegistrySystem — findBySolutionPack (005.3A Enhancement 9)", () => {
  it("resolves every bundled reference to its live entry", async () => {
    const system = new RegistrySystem();
    await seedDependencies(system);
    await system.agent.register(CONTENT_MANAGER_MANIFEST);
    await system.industry.register({ id: "automotive", version: "1.0.0", category: "industry" });
    await system.solutionPack.register({
      id: "automotive-pack",
      version: "1.0.0",
      category: "solution_pack",
      industry: ["automotive"],
      agents: ["content-manager"],
      workflows: ["campaign_creation"],
      tools: ["kie", "postiz"],
    });

    const bundle = system.findBySolutionPack("automotive-pack");
    expect(bundle.agents.map((e) => e.manifest.id)).toEqual(["content-manager"]);
    expect(bundle.workflows.map((e) => e.manifest.id)).toEqual(["campaign_creation"]);
    expect(bundle.tools.map((e) => e.manifest.id).sort()).toEqual(["kie", "postiz"]);
    expect(bundle.capabilities).toEqual([]);
    expect(bundle.prompts).toEqual([]);
  });

  it("returns empty arrays for an unknown Solution Pack id", () => {
    const system = new RegistrySystem();
    const bundle = system.findBySolutionPack("does-not-exist");
    expect(bundle).toEqual({ agents: [], workflows: [], tools: [], capabilities: [], prompts: [] });
  });

  it("silently omits ids that don't resolve, without throwing", async () => {
    const system = new RegistrySystem();
    await system.solutionPack.register({
      id: "partial-pack",
      version: "1.0.0",
      category: "solution_pack",
      industry: ["automotive"],
      agents: ["ghost-agent"],
    });
    const bundle = system.findBySolutionPack("partial-pack");
    expect(bundle.agents).toEqual([]);
  });
});
