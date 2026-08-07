/**
 * "REGISTRY: ... Buckets: Policy Registry, Rule Registry, Scope Registry,
 * Assignment Registry, Evaluation Registry, Statistics Registry, Session Registry."
 * (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the exact 7 buckets from the prompt.
 */
export enum KnowledgePolicyRegistryBucket {
  POLICY = "policy",
  RULE = "rule",
  SCOPE = "scope",
  ASSIGNMENT = "assignment",
  EVALUATION = "evaluation",
  STATISTICS = "statistics",
  SESSION = "session",
}
