import { RegistryKind } from "../contracts/registry-kind.js";

/**
 * Declares which manifest fields of which Registry kind reference IDs in another Registry
 * kind — this is the concrete mechanism behind the user's revised manifest example: an
 * Agent's `required_tools: [kie, postiz]` is checked against the Tool Registry, its
 * `required_models` against the Model Registry, its `memory` against the Memory Provider
 * Registry, and its `workflows` against the Workflow Registry. `permissions` is deliberately
 * NOT cross-referenced against the Permission Registry — permission strings ("social.publish")
 * are `resource.action` identifiers, not Permission Registry manifest IDs, a different shape
 * (see validators/permission-validator.ts's structural check instead).
 */
export const CROSS_REFERENCE_MAP: Partial<
  Record<RegistryKind, Readonly<Record<string, RegistryKind>>>
> = {
  [RegistryKind.AGENT]: {
    required_tools: RegistryKind.TOOL,
    required_models: RegistryKind.MODEL,
    memory: RegistryKind.MEMORY_PROVIDER,
    workflows: RegistryKind.WORKFLOW,
  },
  [RegistryKind.WORKFLOW]: {
    required_agents: RegistryKind.AGENT,
    required_tools: RegistryKind.TOOL,
  },
  [RegistryKind.PROMPT]: {
    target_agent: RegistryKind.AGENT,
  },
  // 005.3A additions below — additive only, no existing key changed.
  [RegistryKind.CAPABILITY]: {
    provided_by: RegistryKind.TOOL,
  },
  [RegistryKind.CONNECTOR]: {
    supported_capabilities: RegistryKind.CAPABILITY,
  },
  [RegistryKind.AGENT_BLUEPRINT]: {
    required_capabilities: RegistryKind.CAPABILITY,
    required_tools: RegistryKind.TOOL,
    required_memory: RegistryKind.MEMORY_PROVIDER,
    required_workflows: RegistryKind.WORKFLOW,
  },
  [RegistryKind.SOLUTION_PACK]: {
    industry: RegistryKind.INDUSTRY,
    agents: RegistryKind.AGENT,
    workflows: RegistryKind.WORKFLOW,
    tools: RegistryKind.TOOL,
    capabilities: RegistryKind.CAPABILITY,
    prompts: RegistryKind.PROMPT,
  },
};
