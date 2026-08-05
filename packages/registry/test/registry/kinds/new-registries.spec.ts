import { describe, expect, it } from "vitest";

import { agentBlueprintManifestSchema } from "../../../src/registry/kinds/agent-blueprint-registry.js";
import { industryManifestSchema } from "../../../src/registry/kinds/industry-registry.js";
import { modelProfileManifestSchema } from "../../../src/registry/kinds/model-profile-registry.js";
import { solutionPackManifestSchema } from "../../../src/registry/kinds/solution-pack-registry.js";

describe("Schema Test — industryManifestSchema (005.3A Enhancement 4)", () => {
  it("accepts a top-level industry with no parent", () => {
    expect(
      industryManifestSchema.safeParse({ id: "automotive", version: "1.0.0", category: "industry" })
        .success,
    ).toBe(true);
  });

  it("accepts a nested industry via parent_industry", () => {
    expect(
      industryManifestSchema.safeParse({
        id: "leasing",
        version: "1.0.0",
        category: "industry",
        parent_industry: "automotive",
      }).success,
    ).toBe(true);
  });
});

describe("Schema Test — solutionPackManifestSchema (005.3A Enhancement 3)", () => {
  it("accepts the full bundled shape", () => {
    const result = solutionPackManifestSchema.safeParse({
      id: "automotive-pack",
      version: "1.0.0",
      category: "solution_pack",
      industry: ["automotive"],
      agents: ["inventory-agent"],
      workflows: ["inventory-sync"],
      tools: ["dms-connector"],
      capabilities: ["inventory.read"],
      prompts: ["inventory-brief"],
      dashboards: ["inventory-dashboard"],
      permission_list: ["inventory-read-permission"],
      policies: ["inventory-guardrail"],
      license: "commercial",
      publisher: "aos",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a Solution Pack with an empty industry array (Industry is the required parent)", () => {
    const result = solutionPackManifestSchema.safeParse({
      id: "orphan-pack",
      version: "1.0.0",
      category: "solution_pack",
      industry: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a Solution Pack with no industry field at all", () => {
    const result = solutionPackManifestSchema.safeParse({
      id: "orphan-pack",
      version: "1.0.0",
      category: "solution_pack",
    });
    expect(result.success).toBe(false);
  });
});

describe("Schema Test — modelProfileManifestSchema (005.3A Enhancement 7)", () => {
  it("accepts the full benchmark/pricing shape", () => {
    const result = modelProfileManifestSchema.safeParse({
      id: "claude-sonnet-5-profile",
      version: "1.0.0",
      category: "model_profile",
      provider: "anthropic",
      reasoning_score: 95,
      coding_score: 93,
      vision_score: 88,
      image_score: 0,
      video_score: 0,
      latency_ms: 850,
      pricing: { inputPerMillionTokens: 3, outputPerMillionTokens: 15, currency: "USD" },
      context_window: 200000,
      recommended_use: ["reasoning", "coding"],
      fallback: "gpt-5.5-profile",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a score above 100", () => {
    const result = modelProfileManifestSchema.safeParse({
      id: "x",
      version: "1.0.0",
      category: "model_profile",
      provider: "anthropic",
      reasoning_score: 150,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing provider", () => {
    const result = modelProfileManifestSchema.safeParse({
      id: "x",
      version: "1.0.0",
      category: "model_profile",
    });
    expect(result.success).toBe(false);
  });
});

describe("Schema Test — agentBlueprintManifestSchema (user addition)", () => {
  it("accepts the exact inventory-agent example from the source prompt", () => {
    const result = agentBlueprintManifestSchema.safeParse({
      id: "inventory-agent",
      version: "1.0.0",
      category: "agent_blueprint",
      industry: ["automotive"],
      required_capabilities: ["inventory.read", "inventory.update"],
      required_tools: ["dms-connector"],
      required_memory: ["short-term"],
      required_workflows: ["inventory-sync"],
      recommended_models: ["gpt-5.5", "claude-sonnet-5"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal blueprint with only the base fields", () => {
    const result = agentBlueprintManifestSchema.safeParse({
      id: "minimal-agent",
      version: "1.0.0",
      category: "agent_blueprint",
    });
    expect(result.success).toBe(true);
  });
});
