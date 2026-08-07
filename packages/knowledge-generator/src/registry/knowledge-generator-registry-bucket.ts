/**
 * "REGISTRY: Buckets: Generation Registry, Session Registry, Job Registry, Prompt
 * Registry, Context Registry, Policy Registry, Statistics Registry, Audit Registry."
 * (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — the exact 8 buckets from the prompt.
 */
export enum KnowledgeGeneratorRegistryBucket {
  GENERATION = "generation",
  SESSION = "session",
  JOB = "job",
  PROMPT = "prompt",
  CONTEXT = "context",
  POLICY = "policy",
  STATISTICS = "statistics",
  AUDIT = "audit",
}
