import { describe, expect, it } from "vitest";

import { RegistryKind } from "../../../src/contracts/registry-kind.js";
import {
  createAgentBlueprintRegistry,
  createAgentRegistry,
  createAnalyticsRegistry,
  createCapabilityRegistry,
  createConfigurationRegistry,
  createConnectorRegistry,
  createEventRegistry,
  createFeatureRegistry,
  createIndustryRegistry,
  createIntegrationRegistry,
  createKnowledgeRegistry,
  createMemoryProviderRegistry,
  createModelProfileRegistry,
  createModelRegistry,
  createPermissionRegistry,
  createPluginRegistry,
  createPolicyRegistry,
  createPromptRegistry,
  createQueueRegistry,
  createSchedulerRegistry,
  createSecretProviderRegistry,
  createSimulationRegistry,
  createSolutionPackRegistry,
  createStorageRegistry,
  createTenantRegistry,
  createToolRegistry,
  createWorkflowRegistry,
} from "../../../src/registry/kinds/index.js";

/**
 * The user's revised prompt's exact "content-manager" Agent manifest, used to validate the
 * Agent Registry specifically; every other kind gets a minimal-but-valid manifest for its
 * own schema, proving all 23 factories are real, independently working Registry instances —
 * not 23 copies of the same untested boilerplate.
 */
const CASES: ReadonlyArray<{
  readonly kind: RegistryKind;
  readonly factory: () => { register: (manifest: unknown) => Promise<unknown> };
  readonly manifest: Record<string, unknown>;
}> = [
  {
    kind: RegistryKind.AGENT,
    factory: createAgentRegistry,
    manifest: {
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
      capabilities: ["content_generation", "image_generation"],
      required_tools: ["kie", "postiz"],
      required_models: ["gpt-5.5", "kie"],
      permissions: ["social.publish"],
      memory: ["campaign_memory"],
      workflows: ["campaign_creation"],
    },
  },
  {
    kind: RegistryKind.TOOL,
    factory: createToolRegistry,
    manifest: {
      id: "kie",
      version: "1.0.0",
      category: "media",
      provider: "kie.ai",
      side_effect_class: "reversible_write",
    },
  },
  {
    kind: RegistryKind.WORKFLOW,
    factory: createWorkflowRegistry,
    manifest: { id: "campaign_creation", version: "1.0.0", category: "marketing" },
  },
  {
    kind: RegistryKind.PROMPT,
    factory: createPromptRegistry,
    manifest: {
      id: "content-brief-prompt",
      version: "1.0.0",
      category: "marketing",
      target_agent: "content-manager",
    },
  },
  {
    kind: RegistryKind.MODEL,
    factory: createModelRegistry,
    manifest: {
      id: "gpt-5.5",
      version: "1.0.0",
      category: "chat",
      provider: "openai",
      cost_tier: "balanced",
    },
  },
  {
    kind: RegistryKind.PLUGIN,
    factory: createPluginRegistry,
    manifest: {
      id: "postiz-plugin",
      version: "1.0.0",
      category: "social",
      entrypoint: "./index.js",
    },
  },
  {
    kind: RegistryKind.EVENT,
    factory: createEventRegistry,
    manifest: { id: "lead-scored", version: "1.0.0", category: "lead" },
  },
  {
    kind: RegistryKind.QUEUE,
    factory: createQueueRegistry,
    manifest: { id: "notification-queue", version: "1.0.0", category: "infra" },
  },
  {
    kind: RegistryKind.SCHEDULER,
    factory: createSchedulerRegistry,
    manifest: {
      id: "nightly-campaign-eval",
      version: "1.0.0",
      category: "marketing",
      trigger_type: "cron",
      schedule_expression: "0 2 * * *",
    },
  },
  {
    kind: RegistryKind.MEMORY_PROVIDER,
    factory: createMemoryProviderRegistry,
    manifest: { id: "campaign_memory", version: "1.0.0", category: "marketing", tier: "episodic" },
  },
  {
    kind: RegistryKind.STORAGE,
    factory: createStorageRegistry,
    manifest: {
      id: "content-assets",
      version: "1.0.0",
      category: "infra",
      provider: "r2",
      bucket_ref: "aos-content",
    },
  },
  {
    kind: RegistryKind.KNOWLEDGE,
    factory: createKnowledgeRegistry,
    manifest: {
      id: "brand-guidelines",
      version: "1.0.0",
      category: "marketing",
      source_type: "document",
    },
  },
  {
    kind: RegistryKind.CAPABILITY,
    factory: createCapabilityRegistry,
    manifest: {
      id: "marketing.generate_content",
      version: "1.0.0",
      category: "capability",
      description: "Generate marketing content",
    },
  },
  {
    kind: RegistryKind.PERMISSION,
    factory: createPermissionRegistry,
    manifest: {
      id: "social-publish",
      version: "1.0.0",
      category: "permission",
      actions: ["create"],
    },
  },
  {
    kind: RegistryKind.POLICY,
    factory: createPolicyRegistry,
    manifest: { id: "budget-guardrail", version: "1.0.0", category: "policy", rule_type: "budget" },
  },
  {
    kind: RegistryKind.INTEGRATION,
    factory: createIntegrationRegistry,
    manifest: {
      id: "postiz-integration",
      version: "1.0.0",
      category: "social",
      provider: "postiz",
      auth_type: "api_key",
    },
  },
  {
    kind: RegistryKind.CONNECTOR,
    factory: createConnectorRegistry,
    manifest: { id: "postiz-connector", version: "1.0.0", category: "social", protocol: "http" },
  },
  {
    kind: RegistryKind.TENANT,
    factory: createTenantRegistry,
    manifest: { id: "acme-motors", version: "1.0.0", category: "dealer", plan_tier: "shared" },
  },
  {
    kind: RegistryKind.CONFIGURATION,
    factory: createConfigurationRegistry,
    manifest: { id: "campaign-defaults", version: "1.0.0", category: "marketing" },
  },
  {
    kind: RegistryKind.FEATURE,
    factory: createFeatureRegistry,
    manifest: {
      id: "content-manager-v2",
      version: "1.0.0",
      category: "marketing",
      flag_key: "content_manager_v2",
    },
  },
  {
    kind: RegistryKind.SECRET_PROVIDER,
    factory: createSecretProviderRegistry,
    manifest: { id: "vault-primary", version: "1.0.0", category: "infra", provider: "vault" },
  },
  {
    kind: RegistryKind.ANALYTICS,
    factory: createAnalyticsRegistry,
    manifest: { id: "campaign-roi-dashboard", version: "1.0.0", category: "marketing" },
  },
  {
    kind: RegistryKind.SIMULATION,
    factory: createSimulationRegistry,
    manifest: { id: "content-manager-scenarios", version: "1.0.0", category: "marketing" },
  },
  // 005.3A additions — 4 new Registry kinds, appended (the original 23 above are untouched).
  {
    kind: RegistryKind.INDUSTRY,
    factory: createIndustryRegistry,
    manifest: { id: "automotive", version: "1.0.0", category: "industry" },
  },
  {
    kind: RegistryKind.SOLUTION_PACK,
    factory: createSolutionPackRegistry,
    manifest: {
      id: "automotive-pack",
      version: "1.0.0",
      category: "solution_pack",
      industry: ["automotive"],
    },
  },
  {
    kind: RegistryKind.MODEL_PROFILE,
    factory: createModelProfileRegistry,
    manifest: {
      id: "claude-sonnet-5-profile",
      version: "1.0.0",
      category: "model_profile",
      provider: "anthropic",
      reasoning_score: 92,
    },
  },
  {
    kind: RegistryKind.AGENT_BLUEPRINT,
    factory: createAgentBlueprintRegistry,
    manifest: {
      id: "inventory-agent",
      version: "1.0.0",
      category: "agent_blueprint",
      industry: ["automotive"],
      required_capabilities: ["inventory.read", "inventory.update"],
      required_tools: ["dms-connector"],
      required_memory: ["short-term"],
      required_workflows: ["inventory-sync"],
      recommended_models: ["gpt-5.5", "claude-sonnet-5"],
    },
  },
];

describe("All 27 mandatory Registry kinds (23 original + 4 from 005.3A)", () => {
  it("covers exactly the 27 kinds enumerated in RegistryKind", () => {
    expect(CASES).toHaveLength(27);
    expect(new Set(CASES.map((c) => c.kind)).size).toBe(27);
  });

  it.each(CASES)(
    "$kind Registry: factory produces a working Registry that accepts its own manifest shape",
    async ({ factory, manifest, kind }) => {
      const registry = factory();
      const entry = await registry.register(manifest);
      expect((entry as { manifest: { id: string } }).manifest.id).toBe(manifest.id);
      void kind;
    },
  );
});
