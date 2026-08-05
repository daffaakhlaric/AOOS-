/**
 * The 23 mandatory Registry kinds (docs/PROMPT-005.3-REGISTRY-SYSTEM.md), plus 4 additive
 * kinds introduced by docs/PROMPT-005.3A-REGISTRY-ENHANCEMENT.md (INDUSTRY, SOLUTION_PACK,
 * MODEL_PROFILE, AGENT_BLUEPRINT). Existing members are never renamed or removed — see
 * Enhancement 10 (Backward Compatibility).
 */
export enum RegistryKind {
  AGENT = "agent",
  TOOL = "tool",
  WORKFLOW = "workflow",
  PROMPT = "prompt",
  MODEL = "model",
  PLUGIN = "plugin",
  EVENT = "event",
  QUEUE = "queue",
  SCHEDULER = "scheduler",
  MEMORY_PROVIDER = "memory_provider",
  STORAGE = "storage",
  KNOWLEDGE = "knowledge",
  CAPABILITY = "capability",
  PERMISSION = "permission",
  POLICY = "policy",
  INTEGRATION = "integration",
  CONNECTOR = "connector",
  TENANT = "tenant",
  CONFIGURATION = "configuration",
  FEATURE = "feature",
  SECRET_PROVIDER = "secret_provider",
  ANALYTICS = "analytics",
  SIMULATION = "simulation",
  /** 005.3A Enhancement 4 — parent of Solution Pack. */
  INDUSTRY = "industry",
  /** 005.3A Enhancement 3. */
  SOLUTION_PACK = "solution_pack",
  /** 005.3A Enhancement 7 — distinct from MODEL (routing config vs. benchmark/pricing profile). */
  MODEL_PROFILE = "model_profile",
  /** 005.3A addition (user-suggested) — declarative Agent template for AI Builder/Marketplace. */
  AGENT_BLUEPRINT = "agent_blueprint",
}

export const ALL_REGISTRY_KINDS: readonly RegistryKind[] = Object.values(RegistryKind);
